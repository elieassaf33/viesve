import "./styles/main.css";
import Alpine from "alpinejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);
window.Alpine = Alpine;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isConfigurator = !!document.getElementById("configurator-canvas");

/*
 * SINGLE rAF LOOP: gsap.ticker is the only requestAnimationFrame driver.
 * Lenis (autoRaf:false) is advanced from it, forwards scroll to ScrollTrigger,
 * and every Three.js SceneManager registers its render on the same ticker.
 * Registered first => scroll position is updated before any render runs.
 */
let lenis = null;
if (!reducedMotion && !isConfigurator) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el, { offset: -80 });
      }
    })
  );
}

// DOM reveals: transform + opacity only.
if (!reducedMotion) {
  gsap.utils.toArray(".reveal-card").forEach((card) =>
    gsap.from(card, {
      opacity: 0,
      y: 28,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: { trigger: card, start: "top 88%", once: true },
    })
  );
}

async function boot() {
  if (document.getElementById("hero-3d-stage")) {
    const { initScrollShowcase } = await import("./three/ScrollShowcase.js");
    initScrollShowcase({ reducedMotion });
  }
  if (isConfigurator) {
    const { initConfigurator } = await import("./three/ConfiguratorApp.js");
    initConfigurator(); // must register viesveConfiguratorApp before Alpine starts
  }
  Alpine.start();
}
boot();
