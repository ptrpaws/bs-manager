import { LinkMapsModal } from "renderer/components/modal/modal-types/link-maps-modal.component";
import { UnlinkMapsModal } from "renderer/components/modal/modal-types/unlink-maps-modal.component";
import { Subject, Observable, of } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMapsProgress, BsmLocalMap, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService } from "./modale.service";
import { DeleteMapsModal } from "renderer/components/modal/modal-types/delete-maps-modal.component";
import { ProgressBarService } from "./progress-bar.service";
import { OpenSaveDialogOption } from "shared/models/ipc";
import { NotificationService } from "./notification.service";
import { ConfigurationService } from "./configuration.service";
import { ArchiveProgress } from "shared/models/archive.interface";
import { map, last, catchError, distinctUntilChanged, mergeMap } from "rxjs/operators";
import { ProgressionInterface } from "shared/models/progress-bar";
import { FolderLinkerService } from "./folder-linker.service";

export class MapsManagerService {

    private static instance: MapsManagerService;

    public static getInstance(): MapsManagerService{
        if(!MapsManagerService.instance){ MapsManagerService.instance = new MapsManagerService() }
        return MapsManagerService.instance;
    }

    public static readonly REMEMBER_CHOICE_DELETE_MAP_KEY = "not-confirm-delete-map"

    private readonly ipcService: IpcService;
    private readonly modal: ModalService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;
    private readonly config: ConfigurationService;
    private readonly linker: FolderLinkerService;

    private readonly lastLinkedVersion$: Subject<BSVersion> = new Subject();
    private readonly lastUnlinkedVersion$: Subject<BSVersion> = new Subject();

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.modal = ModalService.getInsance();
        this.progressBar = ProgressBarService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.config = ConfigurationService.getInstance();
        this.linker = FolderLinkerService.getInstance();
    }

    private async getVersionMapsPath(version: BSVersion): Promise<string>{
        return this.ipcService.sendV2<string>("get-version-maps-path", {args: version}).toPromise();
    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMapsProgress>{
        return this.ipcService.sendV2<BsmLocalMapsProgress>("load-version-maps", {args: version}, {loaded: 0, total: 0, maps: []});
    }

    public async versionHaveMapsLinked(version: BSVersion): Promise<boolean>{
        const versionMapsPath = await this.getVersionMapsPath(version);
        return this.linker.isFolderLinked(versionMapsPath).toPromise();
    }

    public async linkVersion(version: BSVersion): Promise<void>{

        const modalRes = await this.modal.openModal(LinkMapsModal);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const versionMapsPath = await this.getVersionMapsPath(version);

        return this.linker.linkFolder(versionMapsPath, {keepContents: !!modalRes.data}).toPromise();
    }

    public async unlinkVersion(version: BSVersion): Promise<void>{

        const modalRes = await this.modal.openModal(UnlinkMapsModal);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const versionMapsPath = await this.getVersionMapsPath(version);

        return this.linker.unlinkFolder(versionMapsPath, {keepContents: !!modalRes.data}).toPromise();
    }

    public async deleteMaps(maps: BsmLocalMap[], version?: BSVersion): Promise<boolean>{

        const versionLinked = await this.versionHaveMapsLinked(version);

        const askModal = maps.length > 1 || !this.config.get<boolean>(MapsManagerService.REMEMBER_CHOICE_DELETE_MAP_KEY);

        if(askModal){
            const modalRes = await this.modal.openModal(DeleteMapsModal, {linked: versionLinked, maps});
            if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return false; }
        }

        const showProgressBar = this.progressBar.require(); 

        const progress$ = this.ipcService.sendV2<DeleteMapsProgress>("delete-maps", {args: maps}).pipe(map(progress => (progress.deleted / progress.total) * 100));

        showProgressBar && this.progressBar.show(progress$, true);

        progress$.toPromise().finally(() => this.progressBar.hide(true));

        return progress$.pipe(last(), map(() => true), catchError(() => of(false))).toPromise().catch(() => false);
    }

    public async exportMaps(version: BSVersion, maps?: BsmLocalMap[]): Promise<void>{
        if(!this.progressBar.require()){ return; }

        const resFile = await this.ipcService.send<string, OpenSaveDialogOption>("save-file", {args: {
            filename: version ? `${version.BSVersion}Maps` : "Maps",
            filters: [{name: "zip", extensions: ["zip"]}]
        }});

        if(!resFile.success){ return; }

        const exportProgress$: Observable<ProgressionInterface> = await this.ipcService.sendV2<ArchiveProgress, {version: BSVersion, maps: BsmLocalMap[], outPath: string}>("export-maps", {args: {version, maps, outPath: resFile.data}}).pipe(
            map(p => {
                return { progression: (p.prossesedFiles / p.totalFiles) * 100, label: `${p.prossesedFiles} / ${p.totalFiles}` } as ProgressionInterface
            })
        );

        this.progressBar.show(exportProgress$, true);

        await exportProgress$.toPromise().catch(e => {
            this.notifications.notifyError({title: "notifications.types.error", desc: e.message});
        }).then(() => {
            this.notifications.notifySuccess({title: "Export terminé 🎉", duration: 3000});
            this.progressBar.complete();
            this.progressBar.hide(true);
        });
        
    }

    public async isDeepLinksEnabled(): Promise<boolean>{
        const res = await this.ipcService.send<boolean>("is-map-deep-links-enabled");
        return res.success ? res.data : false;
    }

    public async enableDeepLink(): Promise<boolean>{
        const res = await this.ipcService.send<boolean>("register-maps-deep-link");
        return res.success ? res.data : false;
    }

    public async disableDeepLink(): Promise<boolean>{
        const res = await this.ipcService.send<boolean>("unregister-maps-deep-link");
        return res.success ? res.data : false;
    }

    public get versionLinked$(): Observable<BSVersion>{
        return this.lastLinkedVersion$.asObservable();
    }

    public get versionUnlinked$(): Observable<BSVersion>{
        return this.lastUnlinkedVersion$.asObservable();
    }

    public $mapsLinkingPending(version: BSVersion): Observable<boolean>{
        return this.linker.queue$.pipe(mergeMap(async queue => {
            const versionMapsPath = await this.getVersionMapsPath(version);
            return queue.some(q => q.folder.includes(versionMapsPath));
        }), distinctUntilChanged());
    }

}