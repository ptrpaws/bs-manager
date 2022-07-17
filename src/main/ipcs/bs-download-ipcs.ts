import { ipcMain } from 'electron';
import { BSVersion } from '../services/bs-version-lib.service';
import { BSInstallerService, DownloadEventType } from '../services/bs-installer.service';
import { IpcRequest } from 'shared/models/ipc';
import { InstallationLocationService } from '../services/installation-location.service';
import { UtilsService } from '../services/utils.service';


export interface InitDownloadInfoInterface {
  cwd: string ,
  folder: string,
  app: string,
  depot: string,
  manifest: string,
  username: string,
  stay: boolean
}

export interface DownloadInfo {
  bsVersion: BSVersion,
  username: string,
  password?: string,
  stay?: boolean
}

ipcMain.on('bs-download.start', async (event, request: IpcRequest<DownloadInfo>) => {
  BSInstallerService.getInstance().downloadBsVersion(request.args).then(res => {
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: res});
  }).catch(e => {
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: false, data: e});
  });
});

ipcMain.on(`bs-download.${"[2FA]" as DownloadEventType}`, async (event, args: IpcRequest<string>) => {
  BSInstallerService.getInstance().sendInputProcess(args.args);
});

ipcMain.on('bs-download.kill', async (event, request: IpcRequest<void>) => {
   const res = await BSInstallerService.getInstance().killDownloadProcess();
   if(request.responceChannel){ UtilsService.getInstance().ipcSend(request.responceChannel, {success: res}); }
});

ipcMain.on('bs-download.installation-folder', async (event, request: IpcRequest<void>) => {
  const installationFolder = InstallationLocationService.getInstance().installationDirectory;
  UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: installationFolder});
});

ipcMain.on('bs-download.set-installation-folder', (event, request: IpcRequest<string>) => {
  const installerService = InstallationLocationService.getInstance();
  installerService.setInstallationDirectory(request.args).then(res => {
    console.log("déplacement terminer");
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: res});
  }).catch(err => {
    console.log(err);
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: false, error: {title: err, type: 'error'}});
  });
})


