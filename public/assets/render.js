import { state } from './state.js';

export const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(name, size = 20, css = '', label = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === 'Compass' ? 1.6 : 2}" stroke-linecap="round" stroke-linejoin="round" class="${h(css)}" ${label ? `role="img" aria-label="${h(label)}"` : 'aria-hidden="true"'}><use href="/assets/icons.svg#${h(name)}"></use></svg>`;
}
export function siteIcon(url, name, large = false) {
  return `<span class="site-icon${large ? ' large' : ''}">${url ? `<img src="${h(url)}" alt="${h(name)}图标" width="${large ? 104 : 44}" height="${large ? 104 : 44}">` : icon('Globe2', large ? 54 : 30, '', '默认网站图标')}</span>`;
}
function categoryIcon(name) {
  const type = [/常用/, /AI|人工智能/i, /开发/, /办公/, /设计/, /卡牌/].findIndex(pattern => pattern.test(name));
  return icon(['Star', 'Bot', 'Monitor', 'Briefcase', 'Palette', 'WalletCards'][type] || 'Folder', 21, 'category-icon' + (type === 0 ? ' star' : ''));
}
function action(name, id, css, content, label = '', disabled = false) {
  return `<button class="${css}" data-action="${name}" data-id="${h(id)}" ${label ? `aria-label="${h(label)}"` : ''} ${disabled ? 'disabled' : ''}>${content}</button>`;
}
function siteCard(site, disabled) {
  const description = site.description || new URL(site.url).hostname;
  const body = siteIcon(site.icon_url, site.name) + `<span class="site-text"><strong>${h(site.name)}</strong><span>${h(description)}</span></span>`;
  return `<div class="site-wrap" data-site-id="${h(site.id)}">${state.admin
    ? `<div class="site-card managed">${action('drag-site', site.id, 'drag-handle', icon('GripVertical'), '拖动网站 ' + site.name, disabled)}${body}${action('site-menu', site.id, 'icon-button more-button', icon('MoreHorizontal', 21), site.name + '更多操作', disabled)}</div>`
    : `<a class="site-card" href="${h(site.url)}" target="_blank" rel="noopener noreferrer" title="${h(site.name + ' — ' + description)}">${body}</a>`}</div>`;
}
function categorySection(category, disabled) {
  return `<section class="category${state.admin ? ' managed-category' : ''}" aria-label="${h(category.name)}" data-category-id="${h(category.id)}"><header class="category-header">${state.admin ? action('drag-category', category.id, 'drag-handle category-drag', icon('GripVertical'), '拖动分类 ' + category.name, disabled) : ''}${categoryIcon(category.name)}<h2>${h(category.name)}</h2><span class="count" aria-label="${category.sites.length} 个网站">${category.sites.length}</span>${state.admin ? action('edit-category', category.id, 'icon-button edit-category', icon('Pencil', 14), '编辑分类 ' + category.name, disabled) + `<span class="category-menu">${action('category-menu', category.id, 'icon-button more-button', icon('MoreHorizontal', 21), category.name + '更多操作', disabled)}</span>` : ''}</header><div class="site-grid">${category.sites.map(site => siteCard(site, disabled)).join('')}</div>${state.admin ? `${!category.sites.length ? '<p class="category-empty">暂无网站</p>' : ''}${action('add-site', category.id, 'add-button', icon('Plus', 18) + '添加网站', '', disabled)}` : ''}</section>`;
}
export function render() {
  const main = document.querySelector('main');
  if (state.error) {
    main.innerHTML = '<div class="empty-state"><h2>加载失败，请稍后重试</h2><button class="button secondary" data-action="retry">重新加载</button></div>';
    return;
  }
  const busy = state.sorting || state.loggingOut;
  const manage = document.querySelector('.manage-button');
  manage.disabled = busy;
  manage.innerHTML = icon(state.admin ? 'CheckCircle2' : 'Settings', state.admin ? 19 : 18) + `<span>${state.loggingOut ? '退出中…' : state.admin ? '完成管理' : '管理'}</span>`;
  document.title = state.data.settings.site_name;
  document.querySelector('.brand h1').textContent = state.data.settings.site_name;
  document.querySelector('.search-box button').hidden = !state.search;
  main.className = 'page-content' + (state.admin ? ' admin-content' : '');
  const q = state.search.trim().toLocaleLowerCase();
  const categories = state.data.categories.map(category => ({...category, sites: category.sites.filter(site => !q || [site.name, site.description || '', new URL(site.url).hostname].some(text => text.toLocaleLowerCase().includes(q)))})).filter(category => category.sites.length || (state.admin && !q));
  let html = state.admin ? `<div class="admin-banner">${icon('Info')}<span>当前处于管理模式，可添加、编辑、删除和拖动排序分类或网站。</span></div>` : '';
  if (state.admin && q) html += '<p class="search-note">搜索期间暂停拖动排序。<button data-action="clear-search">清除搜索</button>后可调整顺序。</p>';
  if (state.message) html += `<div class="notice" role="alert"><span>${h(state.message)}</span>${action('close-notice', '', 'icon-button', icon('X', 18), '关闭提示')}</div>`;
  html += `<div id="categories">${categories.map(category => categorySection(category, busy || !!q)).join('')}</div>`;
  if (!categories.length) {
    html += `<div class="empty-state">${icon('FolderOpen', 36)}<h2>${q ? '没有找到相关网站' : !state.data.categories.length ? '还没有添加分类' : '暂无网站'}</h2>${q ? action('clear-search', '', 'button secondary', '清除搜索') : state.admin ? action('add-category', '', 'add-button', icon('Plus', 18) + '添加第一个分类') : '<p>进入管理模式，开始整理你的常用网站。</p>'}</div>`;
  }
  if (state.admin && state.data.categories.length) html += action('add-category', '', 'add-button add-category', icon('Plus') + '添加分类', '', busy);
  main.innerHTML = html;
}

document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.closest('.site-icon')) image.parentElement.innerHTML = icon('Globe2', image.closest('.large') ? 54 : 30, '', '默认网站图标');
}, true);
