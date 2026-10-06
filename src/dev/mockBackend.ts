// Backend simulato, in memoria, per sviluppare l'interfaccia in un normale
// browser (`npm run dev`). Non viene mai incluso nell'app distribuita.

import { mockIPC } from "@tauri-apps/api/mocks";

import type { Section, Tag } from "../lib/api";

export function installMockBackend() {
  const library = { path: "/Users/demo/Documents/Alexandria", name: "Alexandria" };
  let opened = false;
  let nextId = 100;
  let sections: Section[] = [
    { id: 1, parentId: null, name: "Medicina", position: 0, articleCount: 12 },
    { id: 2, parentId: 1, name: "Cardiologia", position: 0, articleCount: 7 },
    { id: 3, parentId: 1, name: "Neurologia", position: 1, articleCount: 5 },
    { id: 4, parentId: null, name: "Statistica", position: 1, articleCount: 4 },
    { id: 5, parentId: null, name: "Machine learning", position: 2, articleCount: 9 },
  ];
  let tags: Tag[] = [
    { id: 1, name: "review", color: "blue", articleCount: 3 },
    { id: 2, name: "metodologia", color: "green", articleCount: 2 },
  ];

  const fail = (message: string) => {
    throw message;
  };

  const handlers: Record<string, (args: any) => unknown> = {
    app_status: () => ({
      library: opened ? library : null,
      startupError: null,
      defaultLocation: { path: library.path, exists: false },
    }),
    resolve_library_location: ({ path }) => ({ path, exists: false }),
    open_library: () => ((opened = true), library),
    view_counts: () => ({ all: 30, toRead: 8, favorites: 4, incomplete: 2, unclassified: 3, trash: 0 }),

    list_sections: () => sections,
    create_section: ({ name, parentId }) => {
      const section = { id: nextId++, parentId, name, position: sections.length, articleCount: 0 };
      sections = [...sections, section];
      return section;
    },
    rename_section: ({ id, name }) => {
      sections = sections.map((s) => (s.id === id ? { ...s, name } : s));
    },
    move_section: ({ id, parentId, index }) => {
      const siblings = sections
        .filter((s) => s.parentId === parentId && s.id !== id)
        .sort((a, b) => a.position - b.position);
      siblings.splice(index, 0, sections.find((s) => s.id === id)!);
      const order = new Map(siblings.map((s, i) => [s.id, i]));
      sections = sections.map((s) =>
        order.has(s.id) ? { ...s, parentId: s.id === id ? parentId : s.parentId, position: order.get(s.id)! } : s,
      );
    },
    section_delete_preview: ({ id }) => ({
      subsections: sections.filter((s) => s.parentId === id).length,
      articles: sections.find((s) => s.id === id)?.articleCount ?? 0,
      orphaned: 1,
    }),
    delete_section: ({ id }) => {
      const removed = new Set([id]);
      for (const s of sections) if (s.parentId !== null && removed.has(s.parentId)) removed.add(s.id);
      sections = sections.filter((s) => !removed.has(s.id));
    },

    list_tags: () => tags,
    create_tag: ({ name, color }) => {
      if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) fail(`Esiste già un tag chiamato “${name}”.`);
      const tag = { id: nextId++, name, color, articleCount: 0 };
      tags = [...tags, tag];
      return tag;
    },
    update_tag: ({ id, name, color }) => {
      tags = tags.map((t) => (t.id === id ? { ...t, name, color } : t));
    },
    delete_tag: ({ id }) => {
      tags = tags.filter((t) => t.id !== id);
    },

    "plugin:dialog|open": () => "/Users/demo/Dropbox",
    "plugin:opener|reveal_item_in_dir": () => null,
  };

  mockIPC((cmd, args) => {
    const handler = handlers[cmd];
    if (!handler) return fail(`Comando non simulato: ${cmd}`);
    return handler(args);
  });
}
