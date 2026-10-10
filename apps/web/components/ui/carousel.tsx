"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CarouselApi = UseEmblaCarouselType[1];

type CarouselContextProps = {
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
};

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

export function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error("useCarousel must be used within <Carousel />");
  return context;
}

function Carousel({ className, children, ...props }: React.ComponentProps<"div">) {
  const [emblaRef, api] = useEmblaCarousel({ loop: true });
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
  }, [api]);

  return (
    <CarouselContext.Provider value={{ api, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}>
      <div className={cn("relative", className)} {...props}>
        <div ref={emblaRef} className="overflow-hidden rounded-lg">
          <div className="flex">{children}</div>
        </div>
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 shrink-0 grow-0 basis-full", className)} {...props} />;
}

function CarouselPrevious({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full", className)}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="上一张"
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}

function CarouselNext({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full", className)}
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="下一张"
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}

export { Carousel, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi };
