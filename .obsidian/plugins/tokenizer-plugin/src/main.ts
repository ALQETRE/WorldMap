import { Plugin, TFile, MarkdownView } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class TokenWidget extends WidgetType {
    constructor(private value: string) { super(); }
    toDOM() {
        const span = document.createElement("span");
        span.textContent = this.value;
        return span;
    }
}

function buildTokenPlugin(getTokens: () => Record<string, string>) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: any) {
            this.decorations = this.buildDecorations(view);
        }

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet)
				this.decorations = this.buildDecorations(update.view);
		}

		buildDecorations(view: any): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			const tokens = getTokens();
			const cursor = view.state.selection.main.head;

			for (const { from, to } of view.visibleRanges) {
				const text = view.state.doc.sliceString(from, to);
				const regex = /\{(\w+)\}/g;
				let match;
				while ((match = regex.exec(text)) !== null) {
					const key = match[1] as string;
					if (!(key in tokens)) continue;
					const start = from + match.index;
					const end = start + match[0].length;
					if (cursor >= start && cursor <= end) continue; // skip if cursor is inside
					builder.add(start, end, Decoration.replace({
						widget: new TokenWidget(tokens[key]!)
					}));
				}
			}
			return builder.finish();
		}
    }, { decorations: v => v.decorations });
}

export default class Tokenizer extends Plugin {
	tokens: Record<string, string> = {};


    async onload() {
		this.registerEditorExtension(buildTokenPlugin(() => this.tokens));
		
		this.app.workspace.onLayoutReady(async () => {
			await this.loadTokens();
			this.refreshViews();
		});

        this.registerEvent(
            this.app.vault.on("modify", async (file) => {
                if (file.path === "TOKENS.md") {
					await this.loadTokens();
					this.refreshViews();
				}
				else {
					let newTokensAdded = false;
					const text = await this.app.vault.read(file as TFile);
					for (const newToken of text.matchAll(/\{(\w+)\}/g)) {
						if (newToken[1]! in this.tokens) continue;
						this.tokens[newToken[1]!] = "-";
						newTokensAdded = true;
					}
					if (newTokensAdded) {
						await this.saveTokens();
					}
				}
            })
        );

        this.registerMarkdownPostProcessor((element, context) => {
			element.querySelectorAll("*").forEach((node) => {
				node.childNodes.forEach((child) => {
					if (child.nodeType !== Node.TEXT_NODE) return;
					let text = child.textContent ?? "";
					for (const [key, value] of Object.entries(this.tokens)) {
						text = text.replaceAll(`{${key}}`, value);
					}
					child.textContent = text;
				});
			});
		});
    }
    onunload() {
        // runs when plugin is disabled — cleanup
    }

	async loadTokens() {
		console.log("LOADED TOKENS")
		const file = this.app.vault.getAbstractFileByPath("TOKENS.md") as TFile;
		if (!file) return;
		const text = await this.app.vault.read(file);
		console.log("text:", text);
		this.tokens = {};
		for (const token of text.split("\n")) {
			const [key, ...values] = token.split(":");
			if (key && values.length) {
				this.tokens[key.trim()] = values.join(":").trim();
			}
		}
	}

	async saveTokens() {
		const file = this.app.vault.getAbstractFileByPath("TOKENS.md") as TFile;
		const content = Object.entries(this.tokens)
			.map(([key, val]) => `${key} : ${val}`)
			.join("\n");
				if (!file) return;

		if (file) {
			await this.app.vault.modify(file, content);
		} else {
			await this.app.vault.create("TOKENS.md", content);
		}
	}

	refreshViews() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === "markdown") {
				(leaf.view as MarkdownView).previewMode.rerender(true);
			}
		});
	}
}