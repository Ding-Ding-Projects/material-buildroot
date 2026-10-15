import {html, nothing} from "lit";
import {unsafeSVG} from "lit/directives/unsafe-svg.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/icon-button.js";
import icon0 from "./assets/material-icons/add.svg?raw";
import icon1 from "./assets/material-icons/arrow_back.svg?raw";
import icon2 from "./assets/material-icons/arrow_downward.svg?raw";
import icon3 from "./assets/material-icons/arrow_forward.svg?raw";
import icon4 from "./assets/material-icons/arrow_upward.svg?raw";
import icon5 from "./assets/material-icons/build.svg?raw";
import icon6 from "./assets/material-icons/check.svg?raw";
import icon7 from "./assets/material-icons/close.svg?raw";
import icon8 from "./assets/material-icons/code.svg?raw";
import icon9 from "./assets/material-icons/computer.svg?raw";
import icon10 from "./assets/material-icons/crop_square.svg?raw";
import icon11 from "./assets/material-icons/dashboard.svg?raw";
import icon12 from "./assets/material-icons/delete.svg?raw";
import icon13 from "./assets/material-icons/description.svg?raw";
import icon14 from "./assets/material-icons/download.svg?raw";
import icon15 from "./assets/material-icons/edit.svg?raw";
import icon16 from "./assets/material-icons/folder_open.svg?raw";
import icon17 from "./assets/material-icons/help_outline.svg?raw";
import icon18 from "./assets/material-icons/history.svg?raw";
import icon19 from "./assets/material-icons/info.svg?raw";
import icon20 from "./assets/material-icons/inventory_2.svg?raw";
import icon21 from "./assets/material-icons/link.svg?raw";
import icon22 from "./assets/material-icons/memory.svg?raw";
import icon23 from "./assets/material-icons/menu.svg?raw";
import icon24 from "./assets/material-icons/more_vert.svg?raw";
import icon25 from "./assets/material-icons/open_in_new.svg?raw";
import icon26 from "./assets/material-icons/play_arrow.svg?raw";
import icon27 from "./assets/material-icons/preview.svg?raw";
import icon28 from "./assets/material-icons/redo.svg?raw";
import icon29 from "./assets/material-icons/refresh.svg?raw";
import icon30 from "./assets/material-icons/remove.svg?raw";
import icon31 from "./assets/material-icons/save.svg?raw";
import icon32 from "./assets/material-icons/search.svg?raw";
import icon33 from "./assets/material-icons/security.svg?raw";
import icon34 from "./assets/material-icons/settings.svg?raw";
import icon35 from "./assets/material-icons/stop.svg?raw";
import icon36 from "./assets/material-icons/sync.svg?raw";
import icon37 from "./assets/material-icons/tune.svg?raw";
import icon38 from "./assets/material-icons/undo.svg?raw";
import icon39 from "./assets/material-icons/upload.svg?raw";
import icon40 from "./assets/material-icons/zoom_in.svg?raw";
import icon41 from "./assets/material-icons/zoom_out.svg?raw";
const icons:Record<string,string>={"add":icon0,"arrow_back":icon1,"arrow_downward":icon2,"arrow_forward":icon3,"arrow_upward":icon4,"build":icon5,"check":icon6,"close":icon7,"code":icon8,"computer":icon9,"crop_square":icon10,"dashboard":icon11,"delete":icon12,"description":icon13,"download":icon14,"edit":icon15,"folder_open":icon16,"help_outline":icon17,"history":icon18,"info":icon19,"inventory_2":icon20,"link":icon21,"memory":icon22,"menu":icon23,"more_vert":icon24,"open_in_new":icon25,"play_arrow":icon26,"preview":icon27,"redo":icon28,"refresh":icon29,"remove":icon30,"save":icon31,"search":icon32,"security":icon33,"settings":icon34,"stop":icon35,"sync":icon36,"tune":icon37,"undo":icon38,"upload":icon39,"zoom_in":icon40,"zoom_out":icon41};
/** Only checked-in, licensed Material SVGs enter this renderer. No user markup. */
export function materialIcon(name:string,slot?:string){return html`<md-icon slot=${slot??nothing} aria-hidden="true">${unsafeSVG((icons[name]||icons.build).replace('<svg ','<svg fill="currentColor" aria-hidden="true" '))}</md-icon>`;}
export function actionSymbol(label:string){
 const rules:[RegExp,string][]=[[/^hardware$/i,"memory"],[/^network$/i,"link"],[/^storage$/i,"inventory_2"],[/refresh|discover|inspect status|check for|load models/i,"refresh"],[/undo|rollback|back/i,"undo"],[/redo/i,"redo"],[/remove|delete|revoke|detach/i,"delete"],[/cancel|stop/i,"stop"],[/choose|select.*folder|open.*folder|adopt/i,"folder_open"],[/preview|review|inspect/i,"preview"],[/apply|approve|activate|initialize|complete/i,"check"],[/save|export/i,"save"],[/download|install|pull|fetch/i,"download"],[/upload|import/i,"upload"],[/start|run|resume|launch|send/i,"play_arrow"],[/add|new|create|pair/i,"add"],[/close|dismiss/i,"close"],[/\bup\b/i,"arrow_upward"],[/\bdown\b/i,"arrow_downward"],[/edit|configure|repair/i,"tune"],[/load|reload/i,"refresh"],[/copy|file|example/i,"description"],[/next|continue/i,"arrow_forward"],[/previous/i,"arrow_back"],[/setup|settings/i,"tune"],[/search|find/i,"search"]];return rules.find(([pattern])=>pattern.test(label))?.[1]||"build";
}
export function actionIcon(label:string){return materialIcon(actionSymbol(label),"icon");}
