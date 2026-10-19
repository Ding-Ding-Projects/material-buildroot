# Short viewport shell

## Layout and navigation

At an effective viewport of 480 by 320 CSS pixels, the shell must keep a usable scrolling workspace below its controls. Notification Centre now owns an automatic host height instead of inheriting a full-height workspace host. Its compact trigger remains 44 by 44 pixels and carries the complete localized accessible name and tooltip.

A single shell-scoped compact navigation rule applies at most 900 pixels wide or 500 pixels high. The permanent navigation rail is replaced by the existing labelled navigation dialog, which retains Images, Builds, Tools, Help, Settings and Setup. The menu, actions, attention, notification and window controls remain at least 44 by 44 pixels. Their icon presentation keeps full localized names and tooltips. The header occupies one 52-pixel row. The product label can truncate in that row and is omitted at most 380 pixels wide; application identity remains in the document and workspace content.

The status footer remains keyboard focusable and scrollable, with a 64-pixel maximum in compact presentation. Content is not hidden to manufacture a fit. On short screens the notification review surface scrolls as a whole, so its filters, actions and records remain reachable. Closing it restores focus to its trigger. Opening Setup from compact navigation restores focus to the visible menu trigger when Setup closes.

At 960 by 640 the labelled permanent navigation remains visible, and the notification trigger retains its text label. Preferences, project drafts, destination identities and native action handlers are unchanged. All responsive navigation selectors are shell-scoped so a nested pager retains its own layout.

## Focused verification

The renderer regression uses 480 by 320 CSS pixels, device scale factor 2, bilingual copy and dark appearance. Before the repair it reproduced a 168-pixel notification host around a 48-pixel trigger. After the repair it measured:

| Element | Height | Vertical bounds |
| --- | ---: | --- |
| Header | 52 px | 0 to 52 px |
| Notification host and trigger | 44 px | 3.5 to 47.5 px |
| Main workspace | 158 px | 98 to 256 px |
| Scrollable status | 64 px | 256 to 320 px |

The focused cases verify all five compact navigation destinations, Setup, localized names and tooltips, minimum control dimensions, nonoverlapping main/status geometry, focused and scrolled Create activation, reachable notification export controls and close-focus return, normal desktop navigation, three-language horizontal fit, and unaffected nested-pager geometry. Tests use typed renderer fixtures, and do not execute native operations. Formal built application before/after capture and layout receipts remain separate integration verification.
