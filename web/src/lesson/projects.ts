// Weekly practical projects (frames 21–23), from content/projects/projects.json.

export interface ProjectContent {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly tomorrow: string;
  readonly reportAsk: string;
  readonly hints: readonly string[];
}

export class ProjectRepository {
  private readonly byIdMap: ReadonlyMap<string, ProjectContent>;

  constructor(all: Iterable<ProjectContent>) {
    this.byIdMap = new Map([...all].map((p) => [p.id, p]));
  }

  static fromJson(j: { projects: readonly ProjectContent[] }): ProjectRepository {
    return new ProjectRepository(
      j.projects.map((p) => ({
        id: p.id,
        title: p.title,
        intro: p.intro,
        tomorrow: p.tomorrow,
        reportAsk: p.reportAsk,
        hints: [...p.hints],
      })),
    );
  }

  byId(id: string): ProjectContent {
    const p = this.byIdMap.get(id);
    if (!p) throw new Error(`Unknown project id ${id}`);
    return p;
  }
}
