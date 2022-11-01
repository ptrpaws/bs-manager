import { Link } from "react-router-dom";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { NavBarItem } from "./nav-bar-item.component";

export function MapsNavBarItem() {

    const color = useThemeColor("first-color");

    return (
        <NavBarItem>
            <Link to={"maps"} className="w-full flex items-center justify-start content-center max-w-full h-[30px]">
                <BsmIcon className="w-[19px] h-[19px] mr-[5px] shrink-0 brightness-125" icon="bsMapDifficulty" style={{color}}/>
                <span className="dark:text-gray-200 text-gray-800 font-bold tracking-wide">Maps</span>
            </Link>
        </NavBarItem>
    )
}
