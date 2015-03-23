all:
	./solve_patterns

test:
	./solvdep -v -r http://download.tizen.org/snapshots/tizen/common/latest/repos/x86_64-wayland/packages net-config 2>&1

test2:
	./solvdep -v -r http://download.tizen.org/snapshots/tizen/common/latest/repos/x86_64-wayland/packages 2>&1

clean:
	rm -rf out patterns

distclean: clean
	rm -rf cache
