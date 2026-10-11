import { useEffect, type RefObject } from 'react';

export function useScrollStory(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let stop = () => {};
    function configure() {
      stop();
      root!.classList.remove('scroll-story');
      root!.style.setProperty('--scroll-progress', '0');
      if (preference.matches) return;
      const targets = [...root!.querySelectorAll<HTMLElement>('[data-reveal]')];
      // #explain_notes: Progressive enhancement: content stays visible without JS,
      // and reduced-motion users never receive hidden/revealing sections.
      root!.classList.add('scroll-story');
      targets.forEach((target, index) =>
        target.style.setProperty('--reveal-delay', `${(index % 3) * 65}ms`),
      );
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
        },
        { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
      );
      targets.forEach((target) => observer.observe(target));
      let frame = 0;
      const update = () => {
        frame = 0;
        const distance = document.documentElement.scrollHeight - innerHeight;
        root!.style.setProperty(
          '--scroll-progress',
          String(distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0),
        );
        root!.style.setProperty(
          '--hero-shift',
          `${Math.min(32, Math.max(0, scrollY * 0.065))}px`,
        );
      };
      const requestUpdate = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate);
      update();
      stop = () => {
        observer.disconnect();
        window.removeEventListener('scroll', requestUpdate);
        window.removeEventListener('resize', requestUpdate);
        cancelAnimationFrame(frame);
        root!.style.removeProperty('--hero-shift');
      };
    }
    configure();
    preference.addEventListener('change', configure);
    return () => {
      stop();
      preference.removeEventListener('change', configure);
      root.classList.remove('scroll-story');
    };
  }, [ref]);
}
