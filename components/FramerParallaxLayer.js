// import { m, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
export default function FramerParallaxLayer({
  /*multiplier = 0.1,*/ children,
}) {
  // const { scrollY } = useScroll();
  // const y = useTransform(scrollY, (scrollY) => -scrollY * multiplier);
  return (
    <div
      style={{
        // y,
        top: 0,
        bottom: 0,
        zIndex: -40,
        position: "fixed",
        willChange: "transform",
      }}
      className="h-full w-full absolute left-0 overflow-hidden"
    >
      {children}
    </div>
  );
}
