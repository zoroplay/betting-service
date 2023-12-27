import {ProducerstatusrequestInterface} from "./interfaces/producerstatusrequest.interface";
import {Observable} from "rxjs";
import {GetOddsReply, OddsProbability} from "./interfaces/oddsreply.interface";
import {GetOddsRequest} from "./interfaces/oddsrequest.interface";

interface Outrights {
    GetOdds(data: GetOddsRequest): Observable<GetOddsReply>;
    GetProbability(data: GetOddsRequest): Observable<OddsProbability>;
}

export default Outrights;
