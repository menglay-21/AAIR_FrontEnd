function openDrawer() {
    document.getElementById('drawer-overlay').classList.remove('hidden');
    // Small delay to allow display block to render before transform for animation
    setTimeout(() => {
        document.getElementById('detail-drawer').classList.add('open');
    }, 10);
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
    setTimeout(() => {
        document.getElementById('drawer-overlay').classList.add('hidden');
    }, 300); // match transition duration
}