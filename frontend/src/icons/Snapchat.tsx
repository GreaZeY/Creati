import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

const Snapchat = ({ className, ...props }: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
      {...props}
    >
      <path
        d="M24 4c-5.5 0-10 4.5-10 10 0 1.5.3 2.9.9 4.2C10.6 19.4 8 22.4 8 26c0 3.3 2.2 6.1 5.3 7 1.2 3.5 4.7 6 8.7 6s7.5-2.5 8.7-6c3.1-.9 5.3-3.7 5.3-7 0-3.6-2.6-6.6-6.9-7.8.6-1.3.9-2.7.9-4.2 0-5.5-4.5-10-10-10z"
        fill="#FFFC00"
      />
    </svg>
  );
};

export default Snapchat;
