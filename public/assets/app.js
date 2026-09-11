import { state } from './state.js';
import { api } from './client.js';
import { render } from './render.js';
import { closeMenu, openMenu } from './ui.js';
import { loginDialog, categoryDialog, siteDialog, confirmDialog } from './dialogs.js';

let sortables = [];
function paint() {
  sortables.forEach(sortable => sortable.destroy()); sortables = [];
  render();
  if (!state.admin || state.error) return;
  const disabled = state.sorting || state.loggingOut || !!state.search.trim();
  const options = { animation: 150, forceFallback: true, fallbackTolerance: 7,
    ghostClass: 'dragging', disabled, onStart: () => closeMenu() };
  const container = document.querySelector('#categories');
  sortables.push(new window.Sortable(container, {...options, handle: '.category-drag', draggable: '.category',
    dataIdAttr: 'data-category-id', direction: 'vertical',
    onEnd: event => {
      if (event.oldIndex === event.newIndex) return;
      const ids = [...container.children].map(el => el.dataset.categoryId);
      void persistOrder('categories', null, ids);
    },
  }));
  container.querySelectorAll('.site-grid').forEach(grid => {
    sortables.push(new window.Sortable(grid, {...options, handle: '.drag-handle', draggable: '.site-wrap',
      group: {name: grid.parentElement.dataset.categoryId, pull: false, put: false}, dataIdAttr: 'data-site-id',
      onEnd: event => {
        if (event.oldIndex === event.newIndex) return;
        void persistOrder('sites', grid.parentElement.dataset.categoryId, [...grid.children].map(el => el.dataset.siteId));
      },
    }));
  });
}
async function refresh() {
  try { state.data = await api('/api/navigation'); state.error = false; }
  catch { state.message = '修改已保存，但刷新数据失败，请刷新页面查看最新数据。'; }
  paint();
}
function notify(message) { state.message = message; paint(); }
function login() {
  loginDialog(async () => { state.admin = true; state.message = ''; await refresh(); });
}
window.addEventListener('admin-expired', () => {
  state.admin = false; state.csrf = null;
  notify('管理会话已失效，请重新验证；当前表单内容已保留。'); login();
});
async function checkSession() {
  if (!state.admin || document.hidden) return;
  try {
    const result = await api('/api/admin/session');
    if (!result.authenticated) window.dispatchEvent(new Event('admin-expired'));
    else state.csrf = result.csrf_token;
  } catch {}
}
window.addEventListener('focus', checkSession);
setInterval(checkSession, 60000);
document.querySelector('.manage-button').addEventListener('click', async () => {
  if (!state.admin) { login(); return; }
  if (state.loggingOut || state.sorting) return;
  state.loggingOut = true; paint();
  try { await api('/api/admin/logout','POST'); state.admin = false; state.csrf = null; state.message = ''; closeMenu(); }
  catch (error) { state.message = error.message; }
  finally { state.loggingOut = false; paint(); }
});
function clearSearch() { state.search = ''; document.querySelector('#search').value = ''; paint(); }
document.querySelector('#search').addEventListener('input', event => { state.search = event.target.value; paint(); });
document.querySelector('#search').addEventListener('keydown', event => { if (event.key === 'Escape') clearSearch(); });
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action, id = target.dataset.id;
  if (action === 'clear-search') { clearSearch(); return; }
  if (action === 'retry') { location.reload(); return; }
  if (action === 'close-notice') { state.message = ''; paint(); return; }
  if (!state.admin) return;
  const category = state.data.categories.find(item => item.id === id);
  const site = state.data.categories.flatMap(item => item.sites).find(item => item.id === id);
  if (action === 'add-category') categoryDialog(null, refresh);
  if (action === 'edit-category') categoryDialog(category, refresh);
  if (action === 'add-site') siteDialog(null, id, refresh);
  if (action === 'category-menu') openMenu(target,[
    {label:'编辑分类', icon:'Pencil', run:() => categoryDialog(category,refresh)},
    {label:'删除分类', icon:'Trash2', danger:true, run:() => category.sites.length ? notify(`当前分类下还有 ${category.sites.length} 个网站，请先移动或删除这些网站。`) : confirmDialog('分类',category,refresh)},
  ]);
  if (action === 'site-menu') openMenu(target,[
    {label:'编辑',icon:'Pencil',run:() => siteDialog(site,site.category_id,refresh)},
    {label:'删除',icon:'Trash2',danger:true,run:() => confirmDialog('网站',site,refresh)},
    {label:'打开网站',icon:'ExternalLink',url:site.url},
  ]);
});
async function persistOrder(kind, categoryId, ids) {
  if (state.sorting || state.search.trim() || !state.admin) { paint(); return; }
  const previous = state.data;
  state.sorting = true;
  state.data = {...previous, categories: kind === 'categories'
    ? ids.map(id => previous.categories.find(category => category.id === id))
    : previous.categories.map(category => category.id === categoryId ? {...category, sites:ids.map(id => category.sites.find(site => site.id === id))} : category)};
  paint();
  try {
    await api('/api/admin/' + kind + '/reorder','PUT', kind === 'categories' ? {category_ids:ids} : {category_id:categoryId,site_ids:ids});
  } catch (error) { state.data = previous; state.message = error.message + '，已恢复原顺序。'; }
  finally { state.sorting = false; paint(); }
}
// Keyboard equivalent of drag: pick up with Space, move with arrows, drop with Space.
let keyboardDrag;
document.addEventListener('keydown', event => {
  const handle = event.target.closest('.drag-handle');
  if (!handle || handle.disabled || !state.admin) return;
  const category = handle.classList.contains('category-drag');
  const element = handle.closest(category ? '.category' : '.site-wrap');
  const container = element.parentElement;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (!keyboardDrag) { keyboardDrag = {element, container, original:[...container.children], category}; element.classList.add('dragging'); handle.setAttribute('aria-pressed','true'); }
    else {
      const drag = keyboardDrag; keyboardDrag = null; drag.element.classList.remove('dragging');
      const ids = [...container.children].map(el => category ? el.dataset.categoryId : el.dataset.siteId);
      void persistOrder(category ? 'categories' : 'sites', category ? null : container.closest('.category').dataset.categoryId, ids);
    }
  } else if (keyboardDrag && event.key === 'Escape') {
    event.preventDefault(); keyboardDrag.original.forEach(el => container.append(el)); element.classList.remove('dragging'); handle.setAttribute('aria-pressed','false'); keyboardDrag = null;
  } else if (keyboardDrag && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault(); const before = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const sibling = before ? element.previousElementSibling : element.nextElementSibling;
    if (sibling) container.insertBefore(element, before ? sibling : sibling.nextElementSibling);
    handle.focus();
  }
});
paint();
