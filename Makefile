
PROGRAM_NAME = game-of-life

OBJECT_FILES = $(PROGRAM_NAME).o
CFLAGS = -std=c++11 -stdlib=libc++ -pthread -L /usr/local/Cellar/libconfig/1.5/lib -lconfig++
# -Weverything -wc++98-compat

all:
	clang++ $(CFLAGS) $(PROGRAM_NAME).cpp -o $(PROGRAM_NAME)

