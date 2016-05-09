// Hours: 4

#include <set>
#include <string>
#include <iostream>

#include <thread>
#include <future>

using namespace std;

#include <sstream>
#include <bitset>
std::string bitsOf(int64_t x) {
  std::bitset<64> bitset64{(uint64_t)x};
  std::stringstream ss;
  ss << bitset64;
  return ss.str();
}

// http://chessprogramming.wikispaces.com/De+Bruijn+sequence
// static const int MultiplyDeBruijnBitPosition[64] =
// {
//   0,1,2,4,8,17,34,5,11,23,47,31,63,62,61,59,55,46,29,58,53,43,22,44,24,49,35,7,15,30,60,57,51,38,12,25,50,36,9,18,37,10,21,42,20,41,19,39,14,28,56,48,33,3,6,13,27,54,45,26,52,40,16,32
// };
// http://stackoverflow.com/q/14086854/4026250
uint64_t firstBit(uint64_t v)
{
    static const char index64[64] = {
    63,  0, 58,  1, 59, 47, 53,  2,
    60, 39, 48, 27, 54, 33, 42,  3,
    61, 51, 37, 40, 49, 18, 28, 20,
    55, 30, 34, 11, 43, 14, 22,  4,
    62, 57, 46, 52, 38, 26, 32, 41,
    50, 36, 17, 19, 29, 10, 13, 21,
    56, 45, 25, 31, 35, 16,  9, 12,
    44, 24, 15,  8, 23,  7,  6,  5  };

    static const uint64_t debruijn64 = 0x07EDD5E59A4E28C2ULL;

    return index64[((v & -v) * debruijn64) >> 58];
}

// Reflective right rotation.
// http://stackoverflow.com/a/776523/4026250
inline uint64_t rotr(uint64_t n, unsigned char bits) {
  const unsigned int mask = (CHAR_BIT*sizeof(n)-1);
  // assert ( (bits<=mask) && "rotate by type width or more" );
  bits &= mask;  // avoid undef behaviour with NDEBUG.  0 overhead for most types / compilers
  return (n>>bits) | (n<<( (-bits)&mask ));
}




// TODO(kwyee): Scale:
// Split dijointed groups but have some way to detect/merge them
// Process and save to files / mmap file

// OPT(kwyee):
// Tried a different < operator but that was too slow
// CellNeigborCounts: separate class

// -------
// Cell containing signed 64-bit int.
// Useable in a std::set
// http://stackoverflow.com/questions/15889984/is-a-2d-integer-coordinate-in-a-set
// -------
class Cell {
  public:
    // const static uint64_t MSB_MASK = ((int64_t)1 << (sizeof(int64_t) * CHAR_BIT - 1 ));
    int64_t x,y;
    mutable unsigned char neighborCount = 0; // Used for counting # neighbors but not for keeping track of alive

    Cell() : Cell(0,0) {}
    Cell(int64_t x, int64_t y) : x(x), y(y) {}

    void swap(const Cell& a) { x = a.x; y = a.y; }
    // bool operator< (const Cell& a) const { return x<a.x || (x==a.x && y<a.y); }
    bool operator< (const Cell& a) const {
      if (a.x == x && a.y == y) {
        return false;
      }

      // Find the first bit where this->x and a.x OR this->y and a.y differ.
      uint64_t diffLevel = min(firstBit(x ^ a.x), firstBit(y ^ a.y));
      return cellId(diffLevel) < a.cellId(diffLevel);
    }
  public:
    inline unsigned char cellId(const unsigned char level) const {
      uint64_t mask4level = (((uint64_t)1) << level);
      return (unsigned char)(
        rotr(((uint64_t)x) & mask4level, level-1) |
        rotr(((uint64_t)y) & mask4level, level));
    }

};

// ostream& operator<<(ostream &strm, const Cell &a) { return strm << a.x << ' ' << a.y << " (" << (int)a.neighborCount << ')'; }
ostream& operator<<(ostream &strm, const Cell &a) { return strm << a.x << ' ' << a.y; }
istream& operator>>(istream &strm, Cell &a) { return strm >> a.x >> a.y; }

ostream& operator<<(ostream &strm, const set<Cell> &cells) {
  for (set<Cell>::const_iterator iter = cells.begin(); iter != cells.end(); ++iter) {
      strm << *iter << endl;
  }
  return strm;
}

// Get or insert the cell at the given x, y
const Cell* ginsert(set<Cell> &cellSet, const Cell& cellFinder) {
  auto iter = cellSet.find(cellFinder);
  if (iter == cellSet.end()) {
    cellSet.insert(cellFinder);
    iter = cellSet.find(cellFinder);
  }
  return &(*iter);
}


const Cell* ginsert(set<Cell> &cellSet, const int64_t x, const int64_t y) {
  return ginsert(cellSet, Cell(x,y));
}


// -------
// Operations over set<Cell>
// -------
void _countUp(set<Cell> &neighborCounts, const int64_t x, const int64_t y) {
  for (int64_t xOffset = -1; xOffset <= 1; ++xOffset) {
    for (int64_t yOffset = -1; yOffset <= 1; ++yOffset) {
      if (xOffset == 0 && yOffset == 0) {
        continue;
      }
      const int64_t xi = x+xOffset;
      const int64_t yi = y+yOffset;

      ginsert(neighborCounts, xi, yi)->neighborCount++;
    }
  }
}


void updateSurviving(set<Cell> *alive, const set<Cell> &neighborCounts) {
  set<Cell> surviving;
  for (set<Cell>::const_iterator iter = alive->begin(); iter != alive->end(); ++iter) {
    unsigned char neighborCount = 0;

    // Get the neighborCountCell corresponding to *iter
    auto neighborCountCell = neighborCounts.find(*iter);
    if (neighborCountCell != neighborCounts.end()) {
      // cout << "nc " << *iter << ' ' << (int)neighborCountCell->neighborCount << endl;
      neighborCount = neighborCountCell->neighborCount;
    }
    if (2 <= neighborCount && neighborCount <= 3) {
      // cout << "Still alive " << *iter << neighborCount << endl;
      ginsert(surviving, *iter);
    }
  }
  alive->swap(surviving);
}

void calculateNewlyAlive(set<Cell> *rval, const set<Cell> &neighborCounts) {
  for (set<Cell>::const_iterator iter = neighborCounts.begin(); iter != neighborCounts.end(); ++iter) {
    if (iter->neighborCount == 3) {
      // cout << "becoming alive " << *iter << endl;
      ginsert(*rval, *iter);
    }
  }
}

// Next tick of the simuation
// Modifies alive in-place
void tick(set<Cell> &alive) {
  // If an "alive" cell had less than 2 or more than 3 alive neighbors (in any of the 8 surrounding cells), it becomes dead.
  // If a "dead" cell had *exactly* 3 alive neighbors, it becomes alive.

  // For every cell next to an adjacent cell, count the number of neighbors
  set<Cell> neighborCounts;
  for (set<Cell>::const_iterator iter = alive.begin(); iter != alive.end(); ++iter) {
    _countUp(neighborCounts, iter->x, iter->y);
  }
  // cout << "neighbor counts " << endl << neighborCounts << endl;

  // Figure out who survived from the alive set.
  std::future<void> survivingPromise = std::async(&updateSurviving, &alive, neighborCounts);

  set<Cell> newlyAlive;
  std::future<void> newlyAlivePromise = std::async(&calculateNewlyAlive, &newlyAlive, neighborCounts);

  survivingPromise.get();
  newlyAlivePromise.get();
  alive.insert(newlyAlive.begin(), newlyAlive.end());
}

// -------
// Main
// -------
int main(int argc, const char** argv) {

  // Set of alive cell, read from stdin.
  // Format is:
  // <x1> <y1>
  // <x2> <y2>
  //
  // Use a preprocessor to coerece the format:
  // (e.g. cat patterns/gol.riot | perl -e 'print map { $_ =~ s/[^0-9-. ]//g;"$_\n" } <STDIN>'  | ./game-of-life)
  set<Cell> alive(
    (std::istream_iterator<Cell>(cin)),
    (std::istream_iterator<Cell>())
  );

  int64_t NUM_ITERATIONS = 1000;
  int64_t PRINT_ITERATIONS = 100;

  int64_t iteration = 1;
  cout << "Iteration: " << (iteration-1) << endl << alive << endl;
  for (; iteration <= NUM_ITERATIONS; ++iteration) {
    tick(alive);
    if (iteration % PRINT_ITERATIONS == 0) {
      cout << "Iteration: " << iteration << endl << alive << endl;
    }
  }

  // Trailing print, to dump the last state if we havent already
  if ((iteration-1) % PRINT_ITERATIONS != 0) {
    cout << "Iteration: " << (iteration-1) << endl << alive << endl;
  }

  return 0;
}
