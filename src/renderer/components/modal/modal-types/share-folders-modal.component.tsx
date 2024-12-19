import Tippy from "@tippyjs/react";
import { useEffect, useState } from "react";
import { LinkButton } from "renderer/components/shared/link-button.component";
import { BsmBasicSpinner } from "renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalService } from "renderer/services/modale.service";
import { FolderLinkState, VersionFolderLinkerService, VersionLinkerActionType } from "renderer/services/version-folder-linker.service";
import { lastValueFrom } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { NotificationService } from "renderer/services/notification.service";
import { BasicModal } from "../basic-modal.component";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";

const SHARED_FOLDERS_KEY = "default-shared-folders";
const SHARED_FOLDER_BLACKLIST = {
    error: [
        ".DepotDownloader",
        "Beat Saber_Data",
        "IPA",
        "Libs",
        "Plugins",
        "MonoBleedingEdge",
    ],
    warn: [
        "DLC",
        "Logs",
    ],
};

export const ShareFoldersModal: ModalComponent<void, BSVersion> = ({ options: { data: version } }) => {
    const config = useService(ConfigurationService);
    const linker = useService(VersionFolderLinkerService);

    const t = useTranslationV2();

    const [folders, setFolders] = useState<string[]>(Array.from(new Set([...config.get<string[]>(SHARED_FOLDERS_KEY)]).values()));

    useEffect(() => {
        linker
            .getLinkedFolders(version, { relative: true })
            .toPromise()
            .then(linkedFolders => {
                setFolders(prev => Array.from(new Set([...prev, ...linkedFolders]).values()));
            });
    }, []);

    useEffect(() => {
        if (!folders?.length) {
            config.delete(SHARED_FOLDERS_KEY);
            return;
        }

        config.set(SHARED_FOLDERS_KEY, folders);
    }, [folders]);


    const removeFolder = (index: number) => {
        setFolders(prev => prev.filter((_, i) => i !== index));
    };

    const linkAll = () => {
        folders.forEach(relativeFolder => linker.linkVersionFolder({ version, relativeFolder, type: VersionLinkerActionType.Link }));
    };

    return (
        <form className="w-full max-w-md ">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t.text("modals.shared-folders.title")}</h1>
            <p className="my-3">{t.text("modals.shared-folders.description")}</p>
            <ul className="flex flex-col gap-1 mb-2 h-[300px] max-h-[300px] overflow-scroll scrollbar-default px-1">
                {folders.map((folder, index) => (
                    <FolderItem
                        key={folder}
                        version={version}
                        relativeFolder={folder}
                        onDelete={() => {
                            removeFolder(index);
                        }}
                    />
                ))}
            </ul>
            <div className="grid grid-flow-col gap-3 grid-cols-2">
                <AddFolderButton
                    version={version}
                    folders={folders}
                    setFolders={setFolders}
                />
                <BsmButton icon="link" className="h-8 rounded-md flex justify-center items-center font-bold" typeColor="primary" iconClassName="h-6 aspect-square text-current -rotate-45" onClick={linkAll} withBar={false} text="modals.shared-folders.buttons.link-all" />
            </div>
        </form>
    );
};

function AddFolderButton({
    version,
    folders,
    setFolders,
}: Readonly<{
    version: BSVersion;
    folders: string[];
    setFolders: (value: string[]) => void;
}>) {
    const config = useService(ConfigurationService);
    const ipc = useService(IpcService);
    const versionManager = useService(BSVersionManagerService);
    const notification = useService(NotificationService);
    const modal = useService(ModalService);

    const t = useTranslationV2();

    const addFolder = async () => {
        const versionPath = await lastValueFrom(versionManager.getVersionPath(version));
        const folder = await lastValueFrom(ipc.sendV2("choose-folder", {
            defaultPath: versionPath
        }));

        if (!folder || folder.canceled || !folder.filePaths?.length) {
            return;
        }

        const relativeFolder = await lastValueFrom(ipc.sendV2("full-version-path-to-relative", { version, fullPath: folder.filePaths[0] }));
        if (folders.includes(relativeFolder)) {
            return;
        }

        if (SHARED_FOLDER_BLACKLIST.error.includes(relativeFolder)) {
            notification.notifyError({
                title: "notifications.shared-folder.adding-error.title",
                desc: t.text("notifications.shared-folder.adding-error.msg", {
                    folder: relativeFolder
                }),
            });
            return;
        }

        if (SHARED_FOLDER_BLACKLIST.warn.includes(relativeFolder)) {
            await modal.openModal(BasicModal, { data: {
                title: "modals.adding-shared-folder.title",
                body: t.text("modals.adding-shared-folder.description", {
                    folder: relativeFolder
                }),
                image: BeatConflict,
                buttons: [
                    { id: "cancel", text: "misc.cancel", type: "cancel" },
                    {
                        id: "confirm", text: "misc.confirm", type: "primary",
                        onClick() {
                            config.set(SHARED_FOLDERS_KEY, [...folders, relativeFolder]);
                            return true;
                        },
                    }
                ]
            }});
            return;
        }

        setFolders([...folders, relativeFolder]);
    };

    return <BsmButton
        icon="add"
        className="h-8 rounded-md flex justify-center items-center font-bold bg-light-main-color-1 dark:bg-main-color-1"
        iconClassName="h-6 aspect-square text-current"
        onClick={addFolder}
        withBar={false}
        text="modals.shared-folders.buttons.add-folder"
    />;
}

// -------- FOLDER ITEM --------

type FolderProps = {
    version: BSVersion;
    relativeFolder: string;
    onDelete?: () => void;
};

const FolderItem = ({ version, relativeFolder, onDelete }: FolderProps) => {
    const linker = useService(VersionFolderLinkerService);

    const t = useTranslationV2();

    const color = useThemeColor("first-color");
    const state = useObservable(() => linker.$folderLinkedState(version, relativeFolder), FolderLinkState.Unlinked, [version, relativeFolder]);
    const name = relativeFolder.split(window.electron.path.sep).at(-1);

    const onClickLink = () => {
        if (state === FolderLinkState.Linked) {
            return linker.unlinkVersionFolder({
                version,
                relativeFolder,
                type: VersionLinkerActionType.Unlink,
            });
        }

        return linker.linkVersionFolder({
            version,
            relativeFolder,
            type: VersionLinkerActionType.Link,
        });
    };

    const cancelLink = () => {
        linker.cancelAction(version, relativeFolder);
    };

    return (
        <li className="w-full h-12 rounded-md shrink-0 flex flex-row items-center justify-between px-2 font-bold bg-light-main-color-1 dark:bg-main-color-1">
            <span className="cursor-help" title={relativeFolder}>
                {name}
            </span>
            <div className="flex flex-row gap-1.5">
                <Tippy placement="top" theme="default" content={t.text(`modals.shared-folders.buttons.${state === FolderLinkState.Linked ? "unlink-folder" : "link-folder"}`)}>
                    <LinkButton
                        className="p-0.5 h-7 shrink-0 aspect-square blur-0 cursor-pointer hover:brightness-75"
                        state={state}
                        onClick={onClickLink}
                    />
                </Tippy>
                {(() => {
                    if (state === FolderLinkState.Processing) {
                        return <BsmBasicSpinner className="aspect-square h-7 rounded-md p-1 dark:bg-main-color-2" thikness="3.5px" style={{ color }} />;
                    }
                    if (state === FolderLinkState.Pending) {
                        return (
                            <BsmButton
                                className="aspect-square h-7 rounded-md p-1"
                                icon="cross"
                                withBar={false}
                                onClick={e => {
                                    e.preventDefault();
                                    cancelLink();
                                }}
                            />
                        );
                    }
                    return (
                        <Tippy content={t.text("modals.shared-folders.buttons.remove-from-the-list")} theme="default" hideOnClick={false} placement="top">
                            <BsmButton
                                className="aspect-square h-7 rounded-md p-1"
                                icon="trash"
                                withBar={false}
                                onClick={e => {
                                    e.preventDefault();
                                    onDelete?.();
                                }}
                            />
                        </Tippy>
                    );
                })()}
            </div>
        </li>
    );
};
