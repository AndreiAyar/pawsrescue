import { type ImageProps } from "next/image";
import { Button } from "@repo/ui/button";

type Props = Omit<ImageProps, "src"> & {
  srcLight: string;
  srcDark: string;
};

export default function Home() {
  return (
    <div>
      <div className="w-[300px] h-[300px] bg-red-500">SALUT</div>
    </div>
  );
}
