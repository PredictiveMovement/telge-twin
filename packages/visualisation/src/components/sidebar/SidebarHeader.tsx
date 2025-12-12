import { Link } from "react-router-dom";

export function SidebarHeader() {
  return (
    <div className="flex items-center justify-center px-2 py-4">
      <Link to="/">
        <img 
          src="/ruttger_logo.svg" 
          alt="Ruttger"
          className="w-auto max-w-[65px] h-auto cursor-pointer hover:opacity-80 transition-opacity"
        />
      </Link>
    </div>
  );
}
