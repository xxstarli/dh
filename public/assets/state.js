const initial = JSON.parse(document.getElementById('initial-data').textContent);
export const state = { data: initial.data, admin: !!initial.admin, csrf: initial.csrf,
  search: '', message: '', sorting: false, loggingOut: false, error: !!initial.error };
