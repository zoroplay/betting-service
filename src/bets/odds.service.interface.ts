import {ProducerstatusrequestInterface} from "./interfaces/producerstatusrequest.interface";
import {Observable} from "rxjs";
import {GetOddsReply, OddsProbability} from "./interfaces/oddsreply.interface";
import {GetOddsRequest} from "./interfaces/oddsrequest.interface";
import {ProducerstatusreplyInterface} from "./interfaces/producerstatusreply.interface";

interface Odds {
    GetOdds(data: GetOddsRequest): Observable<GetOddsReply>;
    GetProbability(data: GetOddsRequest): Observable<OddsProbability>;
    GetProducerStatus(data: ProducerstatusrequestInterface): Observable<ProducerstatusreplyInterface>;
}

export default Odds;
