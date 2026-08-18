// Sticky Navigation and Shadow on Scroll
const nav = document.getElementById('top-nav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.classList.add('bg-white/90', 'backdrop-blur-xl', 'shadow-md', 'py-2');
        nav.classList.remove('bg-transparent', 'py-4');
    } else {
        nav.classList.remove('bg-white/90', 'backdrop-blur-xl', 'shadow-md', 'py-2');
        nav.classList.add('bg-transparent', 'py-4');
    }
});

// Scroll Reveal Animation
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(reveal => {
    revealObserver.observe(reveal);
});

// Micro-interaction for buttons
document.querySelectorAll('button, a').forEach(el => {
    el.addEventListener('mousedown', () => el.classList.add('scale-95'));
    el.addEventListener('mouseup', () => el.classList.remove('scale-95'));
    el.addEventListener('mouseleave', () => el.classList.remove('scale-95'));
});