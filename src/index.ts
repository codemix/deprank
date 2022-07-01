import { readFile } from 'fs/promises';

import {
  cruise,
  ICruiseOptions,
  ICruiseResult,
  IDependency,
  IModule,
  allExtensions,
} from 'dependency-cruiser';

export interface Options {
  /**
   * The paths to the source files.
   */
  paths: string[];
  /**
   * Whether to sort files in dependency-order, meaning that
   * files that are depended on by the most important files will appear first.
   */
  depsFirst?: boolean;
  /**
   * The file extensions, defaults to those supported by dependency-cruiser.
   */
  extensions?: string[];
  /**
   * The additional options to pass to dependency-cruiser.
   */
  cruiseOptions?: ICruiseOptions;
}

export const defaultExtensions = allExtensions
  .filter(a => a.available)
  .map(a => a.extension);

export function findModules({ paths, cruiseOptions, extensions }: Options) {
  const result = cruise(paths, cruiseOptions).output as ICruiseResult;
  return result.modules.filter(module =>
    (extensions || defaultExtensions).some(ext => module.source.endsWith(ext))
  );
}

export interface Candidate {
  key: string;
  module: IModule;
  lines: number;
  links: Map<string, number>;
  weight: number;
  outbound: number;
  dependents: number;
  dependencies: IDependency[];
}

async function createCandidate(
  module: IModule,
  options: Options
): Promise<Candidate> {
  return {
    key: module.source,
    module,
    lines: await countLines(module.source),
    links: new Map(),
    weight: 0,
    outbound: 0,
    dependents: 0,
    dependencies: module.dependencies.filter(dep =>
      (options.extensions || defaultExtensions).some(ext =>
        dep.resolved.endsWith(ext)
      )
    ),
  };
}

export async function createCandidates(
  modules: IModule[],
  options: Options
): Promise<Candidate[]> {
  const candidates = await Promise.all(
    modules.map(module => createCandidate(module, options))
  );
  for (const module of candidates) {
    for (const dep of module.dependencies) {
      const target = candidates.find(
        candidate => candidate.key === dep.resolved
      );
      if (target !== undefined) {
        target.dependents += 1;
      }
    }
  }
  return candidates;
}

async function countLines(filename: string): Promise<number> {
  const content = await readFile(filename);
  let lines = 0;
  let inCRLF = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === 13) {
      inCRLF = true;
    } else if (char === 10) {
      inCRLF = false;
      lines++;
    } else if (inCRLF) {
      lines++;
    }
  }
  if (inCRLF) {
    lines++;
  }
  return lines;
}

export function rankCandidates(candidates: Candidate[], options: Options) {
  const indexed = new Map<string, Candidate>();
  // link candidates together
  for (const candidate of candidates) {
    indexed.set(candidate.key, candidate);
    for (const dep of candidate.dependencies) {
      candidate.outbound += candidate.lines;
      const value = candidate.links.get(dep.resolved);
      if (value === undefined) {
        candidate.links.set(dep.resolved, candidate.lines);
      } else {
        candidate.links.set(dep.resolved, value + candidate.lines);
      }
    }
  }

  // magic numbers
  const alpha = 0.85;
  const epsilon = 0.00001;

  // pagerank

  const inverse = 1 / candidates.length;

  for (const candidate of candidates) {
    if (candidate.outbound > 0) {
      for (const [target, value] of candidate.links) {
        candidate.links.set(target, value / candidate.outbound);
      }
    }
  }

  for (const candidate of candidates) {
    candidate.weight = inverse;
  }

  let delta = 1;
  while (delta > epsilon) {
    let leaked = 0;
    const collected = new Map();

    for (const candidate of candidates) {
      collected.set(candidate.key, candidate.weight);
      if (candidate.outbound === 0) {
        leaked += candidate.weight;
      }
      candidate.weight = 0;
    }

    leaked *= alpha;

    for (const candidate of candidates) {
      for (const [target, weight] of candidate.links) {
        const resolved = indexed.get(target);
        if (resolved !== undefined) {
          resolved.weight += alpha * collected.get(candidate.key) * weight;
        }
      }
      candidate.weight += (1 - alpha) * inverse + leaked * inverse;
    }

    delta = 0;

    for (const candidate of candidates) {
      delta += Math.abs(candidate.weight - collected.get(candidate.key));
    }
  }

  const pageRanked = Array.from(candidates).sort(compareCandidates);
  if (!options.depsFirst) {
    return pageRanked;
  }
  return Array.from(sortInDependencyOrder(indexed, pageRanked));
}

function compareCandidates(a: Candidate, b: Candidate) {
  if (a.weight !== b.weight) {
    return b.weight - a.weight;
  }
  return b.dependents - a.dependents;
}

function* sortInDependencyOrder(
  indexed: Map<string, Candidate>,
  sources: Candidate[],
  seen: Set<string> = new Set<string>()
): Iterable<Candidate> {
  for (const source of sources) {
    if (seen.has(source.key)) continue;
    const queue = new Set<Candidate>();
    const def = indexed.get(source.key);
    if (def !== undefined) {
      for (const dep of def?.dependencies) {
        if (!seen.has(dep.resolved) && indexed.has(dep.resolved)) {
          queue.add(indexed.get(dep.resolved)!);
        }
      }
    }
    seen.add(source.key);
    if (queue.size > 0) {
      const sorted = Array.from(queue).sort(compareCandidates);
      yield* sortInDependencyOrder(indexed, sorted, seen);
    }
    yield source;
  }
}

export function printCandidates(candidates: Candidate[]) {
  let maxLength = 0;
  let maxLines = 0;
  let maxDependents = 0;
  for (const candidate of candidates) {
    if (candidate.key.length > maxLength) {
      maxLength = candidate.key.length;
    }
    if (candidate.lines > maxLines) {
      maxLines = candidate.lines;
    }
    if (candidate.dependents > maxDependents) {
      maxDependents = candidate.dependents;
    }
  }

  const maxFilenameLength = Math.max(maxLength, 'Filename'.length);
  const maxLineLength = Math.max(maxLines.toString().length, 'Lines'.length);
  const maxDependentLength = Math.max(
    maxDependents.toString().length,
    'Dependents'.length
  );
  const maxRankLength = 8;

  return `| ${'Filename'.padEnd(maxFilenameLength, ' ')} | ${'Lines'.padEnd(
    maxLineLength,
    ' '
  )} | ${'Dependents'.padEnd(maxDependentLength, ' ')} | ${'PageRank'.padEnd(
    maxRankLength,
    ' '
  )} |\n${''.padEnd(
    maxFilenameLength + maxLineLength + maxRankLength + maxRankLength + 15,
    '-'
  )}\n${candidates
    .map(
      candidate =>
        `| ${candidate.key.padEnd(
          maxFilenameLength,
          ' '
        )} | ${candidate.lines
          .toString()
          .padEnd(
            maxLineLength,
            ' '
          )} | ${candidate.dependents
          .toString()
          .padEnd(maxDependentLength, ' ')} | ${candidate.weight.toFixed(
          maxRankLength - 2
        )} |`
    )
    .join('\n')}`;
}

export async function deprank(options: Options) {
  const modules = findModules(options);
  const candidates = await createCandidates(modules, options);
  const ranked = rankCandidates(candidates, options);
  return printCandidates(ranked);
}
