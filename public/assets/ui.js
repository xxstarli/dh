import { h, icon } from './render.js';

export function modal(title, content, options = {}) {
  const target = document.activeElement;
  const element = document.createElement('dialog');
  const titleId = 'dialog-' + crypto.getRandomValues(new Uint32Array(1))[0];
  element.className = 'modal' + (options.wide ? ' site-modal' : '');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', titleId);
  element.innerHTML = `<header class="modal-header"><h2 id="${titleId}">${h(title)}</h2><button type="button" class="icon-button" aria-label="关闭弹窗" data-close>${icon('X',22)}</button></header><form novalidate>${content}<footer class="modal-footer"><button type="button" class="button secondary" data-close>取消</button><button type="submit" class="button ${options.danger ? 'danger' : 'primary'}">${options.label || '保存'}</button></footer></form>`;
  document.body.append(element);
  const result = {
    element, busy: false,
    close() {
      if (result.busy) return;
      options.onClose?.();
      element.close(); element.remove();
      requestAnimationFrame(() => {
        const top = [...document.querySelectorAll('dialog[open]')].pop();
        const focus = top ? top.querySelector('input,button') : target?.isConnected && target !== document.body ? target : document.querySelector('.manage-button');
        focus?.focus();
      });
    },
    setBusy(busy) {
      result.busy = busy;
      element.querySelectorAll('button,fieldset,input,select').forEach(control => { control.disabled = busy; });
      element.querySelector('button[type="submit"]').textContent = busy ? (options.danger ? '删除中…' : '保存中…') : options.label || '保存';
    },
    error(message) {
      let output = element.querySelector('.form-error');
      if (!output) { output = document.createElement('p'); output.className = 'field-error form-error'; output.setAttribute('role', 'alert'); element.querySelector('.modal-body').append(output); }
      output.textContent = message;
    },
  };
  element.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => result.close()));
  element.addEventListener('cancel', event => { event.preventDefault(); result.close(); });
  element.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...element.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type="file"]),select:not(:disabled),a[href]')].filter(control => control.getClientRects().length > 0);
    const index = controls.indexOf(document.activeElement);
    if (!controls.length) { event.preventDefault(); element.focus(); }
    else if (event.shiftKey && index <= 0) { event.preventDefault(); controls[controls.length - 1].focus(); }
    else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
  });
  element.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if (result.busy) return;
    try { await options.submit(result); } catch (error) { result.error(error.message); }
  });
  element.showModal();
  (element.querySelector('input:not([type="file"]),select') || element.querySelector('footer [data-close]')).focus();
  return result;
}

let currentMenu;
export function closeMenu(restore = false) {
  if (!currentMenu) return;
  const { element, target } = currentMenu;
  element.remove(); target.setAttribute('aria-expanded', 'false');
  if (restore) target.focus();
  currentMenu = null;
}
export function openMenu(target, items) {
  closeMenu();
  const element = document.createElement('div'); element.className = 'menu'; element.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement(item.url ? 'a' : 'button');
    button.setAttribute('role', 'menuitem');
    button.className = item.danger ? 'danger-text' : '';
    button.innerHTML = icon(item.icon,16) + h(item.label);
    if (item.url) { button.href = item.url; button.target = '_blank'; button.rel = 'noopener noreferrer'; }
    button.addEventListener('click', () => { closeMenu(true); item.run?.(); });
    element.append(button);
  }
  document.body.append(element);
  const rect = target.getBoundingClientRect(); const box = element.getBoundingClientRect();
  element.style.left = Math.max(12, Math.min(rect.right - box.width, innerWidth - box.width - 12)) + 'px';
  element.style.top = Math.max(12, rect.bottom + 5 + box.height > innerHeight - 12 ? rect.top - box.height - 5 : rect.bottom + 5) + 'px';
  currentMenu = { element, target }; target.setAttribute('aria-expanded', 'true');
  element.firstElementChild.focus();
  element.addEventListener('keydown', event => {
    const buttons = [...element.children]; const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') { closeMenu(true); if (event.key === 'Escape') event.preventDefault(); }
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
    }
  });
}
document.addEventListener('pointerdown', event => { if (currentMenu && !currentMenu.element.contains(event.target) && !currentMenu.target.contains(event.target)) closeMenu(); });
window.addEventListener('resize', () => closeMenu());
window.addEventListener('scroll', () => closeMenu(), true);
