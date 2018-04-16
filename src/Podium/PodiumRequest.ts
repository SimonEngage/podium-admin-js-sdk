import axios, {AxiosError, AxiosRequestConfig} from 'axios'
import {API_CODE, IAuthResponse, IPodiumErrorResponse, IPodiumPromise, IResponse, ISettings, IUser} from '../../types'
import {ConvertTime} from './ConvertTime'
import {Paginator} from './Paginator'
import {Token} from './Token'

export class PodiumRequest extends Token {
    protected Legacy: boolean = false
    protected Resource: string
    private settings: ISettings
    private ConvertTime: ConvertTime

    constructor(settings: ISettings) {
        super()
        this.settings = settings
        this.ConvertTime = new ConvertTime()
    }

    protected GetRequest<T>(id: number | string): IPodiumPromise<T> {
        const request: AxiosRequestConfig = {
            method: 'get',
        }
        return this.Request(request, `${this.makeURL()}/${id}`)
    }

    protected DeleteRequest<T>(id: number | string): IPodiumPromise<T> {
        const request: AxiosRequestConfig = {
            method: 'delete',
        }
        return this.Request(request, this.makeURL(id))
    }

    protected ListRequest<T>(params: object = {}, paginator: Paginator): IPodiumPromise<T> {
        if (paginator instanceof Paginator) {
            paginator.setLegacyMode(this.Legacy)
            params = Object.assign(params, paginator.toParams())
        }

        const request: AxiosRequestConfig = {
            method: 'get',
            params,
        }
        return this.Request(request, this.makeURL())
    }

    protected PostRequest<T>(data?: object): IPodiumPromise<T> {
        const request: AxiosRequestConfig = {
            data,
            method: 'post',
        }
        return this.Request(request, this.makeURL())
    }

    protected UpdateRequest<T>(id: number | string, data: object): IPodiumPromise<T> {
        const request: AxiosRequestConfig = {
            data,
            method: 'put',
        }
        return this.Request(request, this.makeURL(id))
    }

    protected AuthenticateRequest(username: string, password: string): IPodiumPromise<IUser> {
        this.Resource = 'authenticate'
        return this.PostRequest<IAuthResponse>({
            password,
            type: 'system',
            user_account: username,
        }).then((response) => {
            if (response.apiCode === API_CODE.SYSTEM_ACCOUNT_FOUND) {
                this.SetToken(response.token)
                return response.detail
            }
        })
    }

    protected Request<T>(config: AxiosRequestConfig, url?: string): IPodiumPromise<T> {
        if (!url) {
            url = this.makeURL()
        }
        if ((this.Resource !== 'authenticate') && !this.HasToken()) { // Don't even make the request
            return new Promise((resolve, reject) => {
                reject(API_CODE.INVALID_TOKEN)
            })
        }

        config = Object.assign({
            headers: this.makeHeaders(),
            transformResponse: [(data: string) => {
                return this.ConvertTime.APIToUTC(JSON.parse(data))
            }],
        }, config)

        return new Promise((resolve, reject) => {
            return axios(url, config)
                .then((response) => {
                    resolve(response.data)
                })
                .catch((error) => {
                    this.catchError(error)
                    reject(error)
                })
        })
    }

    private makeURL(id?: number | string): string {
        let build =  this.settings.endpoint + this.Resource
        if (id) {
            build += `/${id}`
        }
        return build
    }

    private makeHeaders(): object {
        if (this.GetToken()) {
            return {
                Authentication: this.GetToken(),
            }
        }
    }

    private catchError(error: AxiosError): IPodiumErrorResponse {
        const podiumError: IPodiumErrorResponse = {
            data: error.response.data as IResponse,
            status: error.response.status,
            statusText: error.response.statusText,
        }

        if ((podiumError.status === 400) && (podiumError.data.apiCode === API_CODE.INVALID_TOKEN)) {
            this.RemoveToken()
        }
        throw podiumError
    }

}
