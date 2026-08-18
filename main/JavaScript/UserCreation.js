function toggleModal() {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');

    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        // Use setTimeout to trigger animations
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }, 10);
    } else {
        overlay.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

// Close modal when clicking outside
window.onclick = function (event) {
    const overlay = document.getElementById('modalOverlay');
    if (event.target == overlay) {
        toggleModal();
    }
}