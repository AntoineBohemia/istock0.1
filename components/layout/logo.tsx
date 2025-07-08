import Image from "next/image";

export default function Logo() {
  return (
    <Image
      src="/logo.png"
      width={30}
      height={30}
      className="me-1 rounded-sm transition-all group-data-collapsible:size-7 group-data-[collapsible=icon]:size-8"
      alt="shadcn ui kit logo"
      unoptimized
    />
  );
}
