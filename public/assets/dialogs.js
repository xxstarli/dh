import { api } from './client.js';
import { state } from './state.js';
import { h, icon, siteIcon } from './render.js';
import { modal } from './ui.js';

export function normalizeUrl(input) {
  const raw = input.trim();
  if (!raw || /[\s\\\u0000-\u001f]/.test(raw) || raw.length > 2048) throw new Error('请输入正确的 HTTP / HTTPS 网站地址');
  const scheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/:]+\.\w+:\d+(\/|$)/.test(raw);
  const url = new URL(scheme ? raw : 'https://' + raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (!url.hostname.includes('.') && url.hostname !== 'localhost' && !url.hostname.includes(':'))) throw new Error('请输入正确的 HTTP / HTTPS 网站地址');
  return url.href;
}
function validName(value) {
  if (!value.trim()) throw new Error('名称不能为空');
  if (value.trim().length > 30) throw new Error('名称最多 30 字符');
  return value.trim();
}
export function loginDialog(onSuccess) {
  if (document.querySelector('#admin-password')) return;
  modal('管理验证', '<div class="modal-body"><label for="admin-password">管理密码</label><input id="admin-password" type="password" autocomplete="current-password" required></div>', {
    label: '进入管理',
    async submit(dialog) {
      const field = dialog.element.querySelector('input');
      if (!field.value) { dialog.error('请输入管理密码'); return; }
      dialog.setBusy(true); dialog.error('');
      try {
        const result = await api('/api/admin/login', 'POST', { password: field.value });
        state.csrf = result.csrf_token;
        dialog.setBusy(false); dialog.close(); await onSuccess();
      } catch (error) { field.setAttribute('aria-invalid','true'); dialog.error(error.message); }
      finally { dialog.setBusy(false); }
    },
  });
}
export function categoryDialog(category, refresh) {
  const name = category?.name || '';
  const dialog = modal(category ? '编辑分类' : '添加分类', `<div class="modal-body"><label for="category-name">分类名称 <em>*</em></label><div class="input-count"><input id="category-name" maxlength="30" value="${h(name)}"><span>${name.length}/30</span></div></div>`, {
    async submit(dialog) {
      const field = dialog.element.querySelector('input');
      try { validName(field.value); } catch (error) { dialog.error(error.message); field.setAttribute('aria-invalid','true'); return; }
      dialog.setBusy(true); dialog.error('');
      try {
        await api('/api/admin/categories' + (category ? '/' + encodeURIComponent(category.id) : ''), category ? 'PATCH' : 'POST', {name: field.value.trim()});
        await refresh(); dialog.setBusy(false); dialog.close();
      } finally { dialog.setBusy(false); }
    },
  });
  dialog.element.querySelector('input').addEventListener('input', event => {
    event.target.nextElementSibling.textContent = event.target.value.length + '/30';
  });
}
export function confirmDialog(kind, value, refresh) {
  modal('删除' + kind, `<div class="modal-body"><p>确定删除“${h(value.name)}”${kind === '分类' ? '分类' : ''}吗？</p><p class="muted">删除后无法恢复。</p></div>`, {
    label: '确认删除', danger: true,
    async submit(dialog) {
      dialog.setBusy(true); dialog.error('');
      try {
        await api('/api/admin/' + (kind === '分类' ? 'categories' : 'sites') + '/' + encodeURIComponent(value.id), 'DELETE');
        await refresh(); dialog.setBusy(false); dialog.close();
      } finally { dialog.setBusy(false); }
    },
  });
}

export function siteDialog(site, categoryId, refresh) {
  let currentIcon = {type: site?.icon_type || 'default', url: site?.icon_url || null};
  let generation = 0, attempted = !!site, fetching = false, uploading = false, lastFetched = site?.url || '';
  const name = site?.name || '', description = site?.description || '';
  const field = (id, label, value, max, hint = '') => `<div class="field"><label for="site-${id}">${label}</label><div class="input-count"><input id="site-${id}" value="${h(value)}" ${max ? `maxlength="${max}"` : ''}>${max ? `<span>${value.length}/${max}</span>` : '<span class="url-check"></span>'}</div><p class="field-error" data-error="${id}" role="alert" hidden></p>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
  const content = `<div class="modal-body site-fields"><fieldset class="fields">${field('name','网站名称 <em>*</em>',name,30)}${field('url','网站地址 <em>*</em>',site?.url || '',0,'请输入完整的网址，如：https://www.example.com')}<div class="field"><label>网站图标</label><div class="icon-editor"><div id="icon-preview">${siteIcon(currentIcon.url,name || '网站',true)}</div><div class="icon-options"><p class="icon-status"></p><div class="icon-actions"><button type="button" class="button secondary" id="fetch-icon"></button><button type="button" class="button upload-button" id="upload-icon">${icon('Upload',18)}上传图片</button></div><input class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传网站图标"><p class="hint">支持 PNG、JPG、WebP 格式，大小不超过 2MB</p></div></div><p class="field-error" role="alert" id="icon-error" hidden></p></div>${field('description','网站说明',description,50,'选填，将显示在网站卡片下方')}<div class="field"><label for="site-category">所属分类 <em>*</em></label><select id="site-category"><option value="" disabled>请选择分类</option>${state.data.categories.map(category => `<option value="${h(category.id)}" ${category.id === (site?.category_id || categoryId) ? 'selected' : ''}>${h(category.name)}</option>`).join('')}</select><p class="field-error" data-error="category" role="alert" hidden></p></div></fieldset></div>`;
  const dialog = modal(site ? '编辑网站' : '添加网站', content, {
    wide: true, onClose: () => generation++,
    async submit(dialog) {
      if (uploading) return;
      let valid = true;
      const name = get('name').value, description = get('description').value;
      for (const element of dialog.element.querySelectorAll('[data-error]')) { element.hidden = true; }
      try { validName(name); } catch (error) { showError('name',error.message); valid = false; }
      let url;
      try { url = normalizeUrl(get('url').value); } catch { showError('url','请输入正确的 HTTP / HTTPS 网站地址'); valid = false; }
      if (description.trim().length > 50) { showError('description','说明最多 50 字符'); valid = false; }
      if (!get('category').value) { showError('category','请选择所属分类'); valid = false; }
      if (!valid) return;
      generation++; fetching = false; dialog.setBusy(true); dialog.error('');
      try {
        await api('/api/admin/sites' + (site ? '/' + encodeURIComponent(site.id) : ''), site ? 'PATCH' : 'POST', {
          name: name.trim(), url, description: description.trim() || null, category_id: get('category').value,
          icon_type: currentIcon.type, icon_url: currentIcon.url,
        });
        await refresh(); dialog.setBusy(false); dialog.close();
      } finally { dialog.setBusy(false); updateIcon(); }
    },
  });
  const get = id => dialog.element.querySelector('#site-' + id);
  const showError = (id, message) => {
    const output = dialog.element.querySelector(`[data-error="${id}"]`);
    output.textContent = message; output.hidden = !message; get(id).setAttribute('aria-invalid', String(!!message));
  };
  const iconError = message => {
    const output = dialog.element.querySelector('#icon-error'); output.textContent = message; output.hidden = !message;
  };
  function updateIcon() {
    const status = dialog.element.querySelector('.icon-status');
    status.className = 'icon-status' + (currentIcon.url ? ' success' : '');
    status.innerHTML = (currentIcon.url ? icon('CheckCircle2',19) : '') + (uploading ? '正在上传图片…' : fetching ? '正在获取网站图标…' : currentIcon.type === 'custom' ? '已使用自定义图标' : currentIcon.url ? '已自动获取网站图标' : attempted ? '未获取到网站图标，将使用默认图标' : '填写网址后自动获取网站图标');
    dialog.element.querySelector('#icon-preview').innerHTML = siteIcon(currentIcon.url,get('name').value || '网站',true);
    const fetchButton = dialog.element.querySelector('#fetch-icon');
    fetchButton.innerHTML = icon('RefreshCw',18,fetching ? 'spinning' : '') + (currentIcon.type === 'custom' ? '恢复自动获取' : '重新获取');
    fetchButton.disabled = fetching || uploading || dialog.busy;
  }
  async function fetchIcon(force = false) {
    let url;
    try { url = normalizeUrl(get('url').value); get('url').value = url; showError('url',''); }
    catch { showError('url','请输入正确的 HTTP / HTTPS 网站地址'); return; }
    if (!force && (currentIcon.type === 'custom' || lastFetched === url)) return;
    const id = ++generation; lastFetched = url; fetching = true; iconError('');
    if (force) currentIcon = {type:'default',url:null};
    updateIcon();
    try {
      const result = await api('/api/admin/favicon','POST',{url});
      if (id === generation) { currentIcon = {type:result.icon_url ? 'auto' : 'default',url:result.icon_url}; attempted = true; }
    } catch (error) {
      if (id === generation) { currentIcon = {type:'default',url:null}; attempted = true; iconError(error.message); }
    } finally { if (id === generation) { fetching = false; updateIcon(); } }
  }
  get('url').placeholder = 'https://www.example.com';
  get('url').addEventListener('input', () => {
    generation++; fetching = false;
    if (currentIcon.type !== 'custom') { currentIcon = {type:'default',url:null}; attempted = false; lastFetched = ''; }
    updateIcon(); updateUrl();
  });
  function updateUrl() {
    let valid = false; try { normalizeUrl(get('url').value); valid = true; } catch {}
    const check = dialog.element.querySelector('.url-check');
    check.innerHTML = valid ? icon('CheckCircle2',20,'valid-check') : '';
    // The icon itself owns the original positioning styles.
    check.style.position = 'static';
  }
  get('url').addEventListener('blur', () => { if (!dialog.busy && !uploading) void fetchIcon(); });
  for (const [id,max] of [['name',30],['description',50]]) get(id).addEventListener('input', () => { get(id).nextElementSibling.textContent = get(id).value.length + '/' + max; });
  dialog.element.querySelector('#fetch-icon').addEventListener('click', () => void fetchIcon(true));
  const fileInput = dialog.element.querySelector('input[type="file"]');
  dialog.element.querySelector('#upload-icon').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    iconError('');
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { iconError('仅支持 PNG、JPG、WebP 图片'); fileInput.value = ''; return; }
    if (!file.size || file.size > 2 * 1024 * 1024) { iconError(file.size ? '图片大小不能超过 2MB' : '图片无法识别'); fileInput.value = ''; return; }
    const id = ++generation; uploading = true; fetching = false; dialog.setBusy(true); updateIcon();
    try {
      const body = new FormData(); body.append('file',file);
      const result = await api('/api/admin/uploads/site-icon','POST',body);
      if (id === generation) currentIcon = {type:'custom',url:result.icon_url};
    } catch (error) { iconError(error.message); }
    finally { uploading = false; dialog.setBusy(false); fileInput.value = ''; updateIcon(); }
  });
  updateIcon(); updateUrl();
}
