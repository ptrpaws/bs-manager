import { splitIntoChunk } from "../../../helpers/array-tools";
import { BsvMapDetail } from "shared/models/maps";
import { SearchParams } from "shared/models/maps/beat-saver.model";
import { BeatSaverApiService } from "./beat-saver-api.service";

export class BeatSaverService {

    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService{
        if(!BeatSaverService.instance){ BeatSaverService.instance = new BeatSaverService(); }
        return BeatSaverService.instance;
    }

    private readonly bsaverApi: BeatSaverApiService;

    private readonly cachedMapsDetails = new Map<string, BsvMapDetail>();

    private constructor(){
        this.bsaverApi = BeatSaverApiService.getInstance();
    }

    public async getMapDetailsFromHashs(hashs: string[]): Promise<BsvMapDetail[]>{

        console.log(hashs);

        const filtredHashs = hashs.map(h => h.toLowerCase()).filter(hash => !Array.from(this.cachedMapsDetails.keys()).includes(hash));
        const chunkHash = splitIntoChunk(filtredHashs, 50);

        const mapDetails = Array.from(this.cachedMapsDetails.entries()).reduce((res , [hash, details]) => {
            if(hashs.includes(hash)){
                res.push(details);
            }
            return res;
        }, [] as BsvMapDetail[]);

        for(const hashs of chunkHash){

            const res = await this.bsaverApi.getMapsDetailsByHashs(hashs);

            if(res.status === 200){
                mapDetails.push(...Object.values<BsvMapDetail>(res.data).filter(detail => !!detail));
                mapDetails.forEach(detail => {
                    this.cachedMapsDetails.set(detail.versions.at(0).hash.toLowerCase(), detail);
                });
            }
        }

        return mapDetails;
    }

    public searchMaps(search: SearchParams): Promise<BsvMapDetail[]>{

        return this.bsaverApi.searchMaps(search).then(res => {
            return res.status === 200 ? res.data.docs : [];
        }).catch(err => {
            console.log(err);
            return [];
        });

    }



}