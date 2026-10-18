# Combined roadmap continuation

Continue the owner-authorized full roadmap, using one isolated worker per item, gpt-6.1-sol for backend and gpt-6-astra for frontend. The current integration branch is ai/integration/20261018-roadmap-combined; normal main release and installed update are still pending.

The task integration branch combines progress documentation b28c8b2, ISO backend7b22e48, ISO workflow555d8a8, source inventoryd8cdbe7, beginner documentationd53a192 and dialog lifecyclee279e28. Backend-focused checks passed10/10. Native and browser acceptance of this combined candidate remains pending.

The real non-root WSL full ISO build is active against the preserved Buildroot2025.02 source in a separate output. Attempt1 stopped because inherited Windows PATH contained spaces; the child-only environment repair passed. Attempt2 reached glibc and stopped at the old16MiB output cap; stopped-session cleanup was verified. Attempt3 resumes unchanged configuration with a256MiB total output ceiling and bounded retained tails. No ISO output or boot success is claimed. Configuration hash:68b5cfd323bb4329dc2719ce29e5df61bb70a528c02d7ff16f69e36554daad54.

The992-detail source-derived inventory is partial, not exhaustive Kconfig or all-version acceptance. It explicitly records missing GUI, Easy-mode, help and runtime evidence. Existing settings, original build output and unrelated applications remain preserved.

Finish integrated renderer tests, exact desktop/documentation builds, genuine hidden-desktop interaction, guided documentation interaction and deployment. Complete the actual ISO build, structure/hash verification and boot/usable-system acceptance. Continue the source-derived Buildroot-to-GUI and Easy-mode gap inventory, including small details and complicated-field documentation. Preserve owned runtime sessions and all work before cleanup. The broader goal is active and incomplete.
