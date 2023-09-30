import {Controller, Get} from "@nestjs/common";

@Controller('consumers')
export class ConsumerController {

    constructor() {
    }

    @Get()
    async status() {

        return {status: 200, message: 'Ok'}
    }
}