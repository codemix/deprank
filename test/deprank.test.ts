import { deprank, findModules } from '../src';

const FIXTURE_DIR = `${__dirname}/../fixtures`;

const options = { paths: [FIXTURE_DIR] };

describe('findModules', () => {
  it('finds all the dependencies in the directory', () => {
    const deps = findModules(options);
    expect(deps.length).toBe(7);
  });
});

describe('deprank', () => {
  it('ranks the fixtures', async () => {
    expect(await deprank(options)).toMatchInlineSnapshot(`
      "| Filename               | Lines | Dependents | PageRank |
      ----------------------------------------------------------
      | fixtures/core.js       | 3     | 1          | 0.284098 |
      | fixtures/utils.js      | 4     | 3          | 0.268437 |
      | fixtures/user/user.js  | 4     | 1          | 0.132253 |
      | fixtures/todo.js       | 6     | 1          | 0.089796 |
      | fixtures/user/index.js | 1     | 1          | 0.089796 |
      | fixtures/concepts.js   | 4     | 1          | 0.079694 |
      | fixtures/index.js      | 4     | 0          | 0.055926 |"
    `);
  });
});
