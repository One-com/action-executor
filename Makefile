REPORTER = spec

test:
	./node_modules/.bin/mocha-chrome \
		--reporter $(REPORTER) \
		test/index.html

.PHONY: test

COVERAGE_DIRS = lib

coverage:
	@echo "Running code coverage"
	@if ! command -v jscoverage > /dev/null ; then \
		echo "Error: jscoverage required"; \
		echo "Please install jscoverage the following way:"; \
		echo "sudo apt-get install jscoverage"; \
		exit 1; \
	fi
	@mkdir -p reports
	@for d in ${COVERAGE_DIRS}; \
	do \
        echo "Instrumenting $$d"; \
		mv "$$d" "$$d.orig"; \
		jscoverage --no-highlight "$$d.orig" "$$d"; \
	done
	@./node_modules/mocha-phantomjs/bin/mocha-phantomjs -p ./node_modules/phantomjs/bin/phantomjs -R json-cov test/index.html | ./node_modules/json2htmlcov/bin/json2htmlcov > reports/coverage.html
	@echo "You can find the code coverage report in reports/coverage.html"
	@for d in ${COVERAGE_DIRS}; \
	do \
		rm -rf "$$d"; \
		mv "$$d.orig" "$$d"; \
	done

.PHONY: coverage
