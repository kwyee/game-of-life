// Hours: 4

#include <unordered_set>
#include <string>
#include <iostream>
#include <sstream>

#include <thread>
#include <future>

#include <libconfig.h++>

using namespace std;

// TODO(kwyee): Scale:
// Split dijointed groups but have some way to detect/merge them
// Process and save to files / mmap file

// OPT(kwyee):
// Tried a different < operator but that was too slow
// CellNeigborCounts: separate class

// -------
// Cell containing signed 64-bit int.
// -------
class Cell {
  public:
    int64_t x,y;
    mutable unsigned char neighborCount = 0; // Used for counting # neighbors but not for keeping track of alive
    mutable bool isAlive = false;

    Cell() : Cell(0,0) {}
    Cell(int64_t x, int64_t y) : x(x), y(y) {}

    // bool operator< (const Cell& a) const { return x<a.x || (x==a.x && y<a.y); }
    inline bool operator == (const Cell &a) const { return (x == a.x) && (y == a.y); }
};

// http://stackoverflow.com/questions/24692601/more-efficient-structure-as-unordered-mappairint-int-int
struct CellHash {
  size_t operator()(const Cell& c) const {
       size_t f = c.x, s = c.y;
       return f << (CHAR_BIT * sizeof(size_t) / 2) | s;
  }
};


// ostream& operator<<(ostream &strm, const Cell &a) {
//   return strm
//   << a.x
//   << ' '
//   << a.y
//   << " (" << (int)a.neighborCount << ')'
//   << " (" << (int)a.isAlive << ')';
// }
ostream& operator<<(ostream &strm, const Cell &a) { return strm << a.x << ' ' << a.y; }
// istream& operator>>(istream &strm, Cell &a) { a.isAlive = true; return strm >> a.x >> a.y; }

ostream& operator<<(ostream &strm, const unordered_set<Cell, CellHash> &cells) {
  for (unordered_set<Cell, CellHash>::const_iterator iter = cells.begin(); iter != cells.end(); ++iter) {
    if (!iter->isAlive) { continue; }
    strm << *iter << endl;
  }
  return strm;
}

// Get or insert the cell at the given x, y
const Cell* ginsert(unordered_set<Cell, CellHash> &cellSet, const int64_t x, const int64_t y) {
  Cell cellFinder(x,y);
  auto iter = cellSet.find(cellFinder);
  if (iter == cellSet.end()) {
    cellSet.insert(cellFinder);
    iter = cellSet.find(cellFinder);
  }
  return &(*iter);
}


// -------
// Operations over unordered_set<Cell>
// -------
void countUp(unordered_set<Cell, CellHash> &neighborCounts, const int64_t x, const int64_t y) {
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

// Next tick of the simuation
// Modifies alive in-place
void tick(unordered_set<Cell, CellHash> &alive) {
  // If an "alive" cell had less than 2 or more than 3 alive neighbors (in any of the 8 surrounding cells), it becomes dead.
  // If a "dead" cell had *exactly* 3 alive neighbors, it becomes alive.
  unordered_set<Cell, CellHash> newAlive;
  for (unordered_set<Cell, CellHash>::const_iterator iter = alive.begin(); iter != alive.end(); ++iter) {
    if ((iter->isAlive && 2 <= iter->neighborCount && iter->neighborCount <= 3) ||
        (!iter->isAlive && iter->neighborCount == 3)) {
      // cout << "Still alive " << *iter << neighborCount << endl;
      ginsert(newAlive, iter->x, iter->y)->isAlive = true;
      countUp(newAlive, iter->x, iter->y);
    }
  }
  alive.swap(newAlive);
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
  // (e.g. ./convert.js --pattern=patterns/gol.riot | ./game-of-life)
  unordered_set<Cell, CellHash> alive;
  string line;
  while (getline(cin, line)) {
    std::stringstream stream(line);
    int64_t x, y;
    stream >> x >> y;
    ginsert(alive, x, y)->isAlive = true;
    countUp(alive, x, y);
  }

  // cout << "Iteration: " << 0 << endl << alive << endl;

  // Read config from game-of-life.cfg
  int num_iterations = 0;
  int print_iterations = 100;
  libconfig::Config config;
  config.readFile("game-of-life.cfg");
  config.lookupValue("num_iterations", num_iterations);
  config.lookupValue("print_iterations", print_iterations);

  int iteration = 1;
  for (; iteration <= num_iterations; ++iteration) {
    tick(alive);
    if (iteration % print_iterations == 0) {
      // cout << "Iteration: " << iteration << endl << alive << endl;
    }
  }

  // Trailing print, to dump the last state if we havent already
  if ((iteration-1) % print_iterations != 0) {
    cout << "Iteration: " << (iteration-1) << endl << alive << endl;
  }

  return 0;
}
