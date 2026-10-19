window.AAIRGuidelineModal = (() => {
    const PDF_URL = '/resource/guidelines/aair-labeling-guidelines.pdf#page=1&zoom=100';
    function init() {
        const existingTrigger = document.querySelector('[data-guideline-trigger]');
        if (document.querySelector('.guideline-modal') && existingTrigger) return;
        document.querySelectorAll('a[href*="aair-labeling-guidelines.pdf"]').forEach(link => link.remove());
        const account = document.querySelector('.review-account, .ra-account, .aa-account, header:first-of-type > div:last-child');
        const button = existingTrigger || (() => {
            if (!account) return null;
            const created = document.createElement('button');
            created.type = 'button'; created.dataset.guidelineTrigger = '';
            created.className = 'guideline-icon-button'; created.title = 'Open labeling guidelines'; created.setAttribute('aria-label', 'Open labeling guidelines');
            created.innerHTML = '<span class="material-symbols-outlined">menu_book</span>';
            account.insertBefore(created, account.firstChild);
            return created;
        })();
        if (!button) return;

        const modal = document.createElement('div');
        modal.className = 'guideline-modal'; modal.hidden = true;
        modal.innerHTML = '<section class="guideline-dialog" role="dialog" aria-modal="true" aria-labelledby="guidelineTitle"><header><div><span class="material-symbols-outlined">menu_book</span><strong id="guidelineTitle">Tài liệu hướng dẫn</strong></div><button type="button" data-guide-close aria-label="Đóng tài liệu hướng dẫn"><span class="material-symbols-outlined">close</span></button></header><iframe title="Tài liệu hướng dẫn AAIR Lab"></iframe></section>';
        document.body.append(modal);
        const iframe = modal.querySelector('iframe');
        const close = () => { modal.hidden = true; document.body.classList.remove('guideline-open'); button.focus(); };
        const open = () => { if (!iframe.src) iframe.src = PDF_URL; modal.hidden = false; document.body.classList.add('guideline-open'); modal.querySelector('[data-guide-close]').focus(); };
        button.addEventListener('click', open);
        modal.querySelector('[data-guide-close]').addEventListener('click', close);
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });
    }
    const style = document.createElement('style');
        style.textContent = '.guideline-icon-button{display:grid!important;place-items:center;width:34px;height:34px;flex:0 0 auto;margin:0 4px 0 0!important;padding:0!important;border:1px solid #087da7!important;border-radius:6px!important;color:#fff!important;background:#087da7!important;cursor:pointer}.guideline-icon-button:hover,.guideline-icon-button:focus-visible{background:#066b91!important;outline:2px solid rgba(8,125,167,.35);outline-offset:1px}.guideline-modal{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:24px;background:rgba(17,31,42,.55)}.guideline-modal[hidden]{display:none}.guideline-dialog{display:flex;width:min(1040px,calc(100vw - 48px));height:min(820px,calc(100vh - 48px));flex-direction:column;overflow:hidden;border:1px solid #bac9d3;border-radius:8px;background:#fff;box-shadow:0 24px 70px rgba(10,29,42,.32)}.guideline-dialog header{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #d5dee5;background:#f7f9fb;color:#263743}.guideline-dialog header>div{display:flex;align-items:center;gap:8px}.guideline-dialog header .material-symbols-outlined{color:#087fa8}.guideline-dialog header button{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:5px;background:transparent;cursor:pointer}.guideline-dialog header button:hover{background:#e6eef3}.guideline-dialog iframe{width:100%;min-height:0;flex:1;border:0;background:#333}.guideline-open{overflow:hidden}';
    document.head.append(style);
    return { init };
})();
window.AAIRGuidelineModal.init();
