const globals = Object.fromEntries(['window','innerWidth','innerHeight','HTMLImageElement','document','crypto','fetch','URL','FormData','AbortController','CustomEvent','HTMLInputElement','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLDialogElement','Event','Sortable','setTimeout','clearTimeout','setInterval','clearInterval','console','process','Buffer','Blob','structuredClone','requestAnimationFrame','location','navigator','performance'].map(name=>[name,'readonly']));
export default [
{ ignores: ['public/assets/sortable.min.js','backups/**','storage/**','dist/**','node_modules/**'] },
{ files: ['**/*.js','**/*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals }, rules: {'no-undef':'error','no-unreachable':'error','no-dupe-args':'error','no-dupe-keys':'error','no-constant-condition':'error','valid-typeof':'error','constructor-super':'error'} }
];
