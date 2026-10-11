import { useEffect, useRef, type RefObject } from 'react';
import '../JourneyBackdrop.css';

export default function JourneyBackdrop({
  page,
}: {
  page: RefObject<HTMLDivElement | null>;
}) {
  const illustration = useRef<SVGSVGElement>(null);
  const route = useRef<SVGPathElement>(null);
  const surface = useRef<SVGPathElement>(null);
  const lanes = useRef<SVGPathElement>(null);
  const streets = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const traveler = useRef<SVGCircleElement>(null);
  const stops = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const root = page.current;
    const svg = illustration.current;
    const path = route.current;
    if (!root || !svg || !path) return;

    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let height = 0;
    let startY = 0;
    let endY = 0;
    let length = 0;
    let frame = 0;
    let previousTime = 0;
    let current = 0;
    let target = 0;
    let initialized = false;

    const scrollPosition = () =>
      Math.max(0, Math.min(1, (scrollY + innerHeight * 0.55 - startY) / (endY - startY)));

    // #explain_notes: Scroll stays native. Only this decorative map route eases
    // toward the scroll position; animation stops as soon as it settles.
    const locate = (y: number) => {
      let low = 0;
      let high = length;
      for (let step = 0; step < 14; step++) {
        const middle = (low + high) / 2;
        if (path.getPointAtLength(middle).y < y) low = middle;
        else high = middle;
      }
      const distance = (low + high) / 2;
      return { distance, point: path.getPointAtLength(distance) };
    };

    const paint = () => {
      const { distance, point } = locate(startY + current * (endY - startY));
      traveler.current?.setAttribute('cx', String(point.x));
      traveler.current?.setAttribute('cy', String(point.y));
      trail.current?.setAttribute('stroke-dasharray', `${distance / length} 1`);
      svg.dataset.progress = current.toFixed(4);
    };

    const animate = (time: number) => {
      frame = 0;
      const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      current += (target - current) * (1 - Math.exp(-elapsed / 170));
      if (Math.abs(target - current) < 0.00005) current = target;
      paint();
      if (current !== target) frame = requestAnimationFrame(animate);
      else previousTime = 0;
    };

    const update = () => {
      target = scrollPosition();
      if (preference.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
        return;
      }
      if (!frame) frame = requestAnimationFrame(animate);
    };

    const layout = () => {
      const bounds = root.getBoundingClientRect();
      const hero = root.querySelector<HTMLElement>('.discovery-hero');
      const width = bounds.width;
      height = root.offsetHeight;
      // The route begins after the cover photo and stays near the page edge.
      startY = (hero ? hero.getBoundingClientRect().bottom - bounds.top : 600) + 30;
      endY = Math.max(startY + 1, height - 120);
      const mobile = width < 700;
      // Stay in the outer gutter so cards cannot cover the route or moving dot.
      const center = width - (mobile ? 12 : 26);
      const amplitude = mobile ? 5 : 14;
      const bends = Math.max(4, Math.ceil((endY - startY) / 460));
      const interval = (endY - startY) / bends;
      let d = `M ${center + amplitude} ${startY}`;
      for (let index = 1; index <= bends; index++) {
        const fromX = center + (index % 2 ? amplitude : -amplitude);
        const toX = center + (index % 2 ? -amplitude : amplitude);
        const fromY = startY + (index - 1) * interval;
        const toY = fromY + interval;
        d += ` C ${fromX} ${fromY + interval / 2}, ${toX} ${toY - interval / 2}, ${toX} ${toY}`;
      }
      path.setAttribute('d', d);
      surface.current?.setAttribute('d', d);
      lanes.current?.setAttribute('d', d);
      trail.current?.setAttribute('d', d);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      length = path.getTotalLength();
      const sections = root.querySelectorAll<HTMLElement>('.discovery-main > section');
      const stages = [sections[1], sections[3], sections[5]];
      let sideStreets = '';
      stages.forEach((section, index) => {
        const y = section
          ? section.getBoundingClientRect().top - bounds.top + 24
          : startY + (index / 2) * (endY - startY);
        const { point } = locate(Math.max(startY, Math.min(endY, y)));
        stops.current[index]?.setAttribute(
          'transform',
          `translate(${point.x} ${point.y})`,
        );
        if (!mobile)
          sideStreets += ` M ${point.x} ${point.y + 20} L ${point.x - 36} ${point.y + 42} L ${point.x - 110} ${point.y + 42}`;
      });
      streets.current?.setAttribute('d', sideStreets);
      if (!initialized) {
        current = scrollPosition();
        initialized = true;
      }
      paint();
      update();
    };

    const observer = new ResizeObserver(layout);
    observer.observe(root);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', layout);
    preference.addEventListener('change', layout);
    layout();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', layout);
      preference.removeEventListener('change', layout);
    };
  }, [page]);

  return (
    <div className="journey-background" aria-hidden="true">
      <svg
        ref={illustration}
        className="journey-background-art"
        preserveAspectRatio="none"
      >
        <path ref={streets} className="journey-map-streets" />
        <path ref={route} className="journey-route" />
        <path ref={surface} className="journey-road-surface" />
        <path ref={lanes} className="journey-road-lanes" />
        <path ref={trail} className="journey-route-trail" pathLength={1} />
        {['PLAN', 'PREPARE', 'TRAVEL'].map((label, index) => (
          <g
            key={label}
            ref={(element) => {
              stops.current[index] = element;
            }}
            className="journey-map-stop"
          >
            <path d="M0 0S-6-6-6-10a6 6 0 1 1 12 0C6-6 0 0 0 0Z" />
            <circle cy="-10" r="2" />
            <text x="-13" y="-7" textAnchor="end">
              {label}
            </text>
          </g>
        ))}
        <circle ref={traveler} className="journey-route-traveler" r="3" />
      </svg>
    </div>
  );
}
