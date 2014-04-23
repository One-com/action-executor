REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/action-executor.spec.js

.PHONY: test

coverage:
	@rm -rf lib-cov
	@jscoverage lib lib-cov
	@COVERAGE=1 ./node_modules/.bin/mocha \
        --reporter html-cov > lib-cov/index.html
	@echo "Coverage report has been generated to lib-cov/index.html"

.PHONY: coverage
