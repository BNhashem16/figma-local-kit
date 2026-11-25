---
name: figma-local
description: Use when working on a Figma design file through the local "Figma Local Bridge" plugin — renaming screens, organizing sections, auditing a page, finding duplicates, hiding layers, or answering questions about a Figma file without using the remote Figma MCP server.
---

# Figma Local Bridge

Work on the Figma file that is open in Figma desktop, through the local `figma-local` MCP tools (`figma_*`). Everything runs on this computer. It costs no Figma API calls.

## Rules

1. Call `figma_status` first. If it fails, tell the user the exact fix from the error text (open the file in Figma desktop, then Plugins > Development > Figma Local Bridge).
2. Use only the `figma_*` tools for Figma. Never call a remote Figma MCP server, not even as a fallback.
3. Never delete anything. The bridge cannot delete, detach instances, swap components, or change colors, text, or layout.
4. Read first, then write. Before any rename, move, or show/hide batch: show the user the list (current name, new name), and wait for a clear yes.
5. Send writes in batches of 60 or fewer. Each write needs the current value in `from`; if it fails because the value changed, re-read and ask again.
6. After writing, read the nodes back with `figma_get_nodes` and report what changed.
7. If the user wants to go back, call `figma_undo_last_change` (repeat to go further back).
8. Reply in the user's language.

## Useful tools

| Need | Tool |
| --- | --- |
| Is it connected? | `figma_status` |
| Pages and selection | `figma_file_info` |
| Health of a page (duplicates, `Frame 12`, `- 02`) | `figma_page_report` |
| Find layers by name or type | `figma_find` |
| What is on a screen | `figma_get_texts`, `figma_screenshot` (scale 0.5) |
| Rename / move / show-hide | `figma_rename`, `figma_move`, `figma_set_visibility` |
| New section | `figma_create_section` |
| Undo | `figma_undo_last_change` |

## Screen names

Use `<Flow> / <Screen> / <State>` in English Title Case, for example `Wallet / Withdraw / Amount Above Balance`.
No version suffixes (`- 02`, `v2`, `new`, `final`, `copy`) and no default names (`Frame 123`, `iPhone 13 mini - 1`). Decide the state from the screenshot and the visible texts, not from a guess.
