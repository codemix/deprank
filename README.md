# Deprank

Deprank uses the [PageRank](https://en.wikipedia.org/wiki/PageRank) algorithm to find the most important files in your JavaScript or TypeScript codebase. It uses [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) to build a dependency graph of your source files, then ranks those dependencies based on their importance. We define _importance_ as those files which are directly or indirectly depended upon the most by other files in the codebase.

Deprank is particularly useful when converting an existing JavaScript codebase to TypeScript. Performing the conversion in strict PageRank order can dramatically increase type-precision, reduce the need for `any` and minimizes the amount of rework that is usually inherent in converting large codebases.

## Usage

Rank all files in the `src` directory:

```sh
npx deprank ./src
```

Rank all `.js` and `.jsx` files in the `src` and `test` directories:

```sh
npx deprank --ext=".js,.jsx" ./src ./test
```

## Example

```sh
npx deprank ./fixtures
```

```
| Filename               | Lines | Dependents | PageRank |
----------------------------------------------------------
| fixtures/core.js       | 3     | 1          | 0.284098 |
| fixtures/utils.js      | 4     | 3          | 0.268437 |
| fixtures/user/user.js  | 4     | 1          | 0.132253 |
| fixtures/todo.js       | 6     | 1          | 0.089796 |
| fixtures/user/index.js | 1     | 1          | 0.089796 |
| fixtures/concepts.js   | 4     | 1          | 0.079694 |
| fixtures/index.js      | 4     | 0          | 0.055926 |
```

## Build

One way to build this project locally:

1. Clone this repository: `git clone git@github.com:codemix/deprank.git`

2. Get [yarn](https://yarnpkg.com/).

3. Navigate into the projekt folder: `cd deprank/`.

4. Run `yarn install` && `yarn build`.

5. Execute, for example using ts-node: `ts-node bin/deprank --help`

# TypeScript Conversion

To help convert your codebase to TypeScript whilst minimizing the amount of effort required, we suggest converting files in `deprank --deps-first` order. This option lifts the files that are depended upon by the most important files in the codebase to the top of the list. By tackling each file in order we help ensure that type errors are solved at their origin, rather than their point of use. This can reduce the number of type errors much more quickly than the more typical, ad-hoc order that such conversions usually take, and it helps TypeScript use inference which reduces the amount of manual typing required. It's not uncommon to see hundreds or thousands of type errors disappear just by fixing a few key files.

The following command will find all `.js` or `.jsx` files in a `src` folder, and sort them in dependency-first order.

```sh
npx deprank --ext=".js,.jsx" --deps-first ./src
```

# Author

deprank was written by [Charles Pick](https://twitter.com/c_pick) at [Codemix](https://codemix.com/)
