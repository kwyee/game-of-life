// Hours: 4

#include <set>
#include <string>
#include <iostream>
#include <fstream>
#include <regex>
#include <limits.h>  // CHAR_BIT
using namespace std;


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
    bool operator< (const Cell& a) const { return x<a.x || (x==a.x && y<a.y); }
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

#include <thread>
#include <future>

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
  // Use a preprocessor to coerece the format
  // (e.g. cat gol.riot | perl -e 'print map { $_ =~ s/[^0-9-. ]//g;"$_\n" } <STDIN>'  | ./game-of-life)
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
