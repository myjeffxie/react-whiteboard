import * as React from "react";
import {message, Popover, Tooltip, Upload} from "antd";
import * as OSS from "ali-oss";
import {PPTProgressPhase, UploadManager} from "@netless/oss-upload-manager";
import TopLoadingBar from "@netless/loading-bar";
import "./index.less";
import {PPTKind, Room, WhiteWebSdk} from "white-web-sdk";
import * as upload from "./image/upload.svg";
import * as image from "./image/image.svg";
import * as uploadActive from "./image/upload-active.svg";
import * as fileTransWeb from "./image/file-trans-web.svg";
import * as fileTransImg from "./image/file-trans-img.svg";
import * as Video from "./image/video.svg";
import * as Audio from "./image/audio.svg";
import {v4 as uuidv4} from "uuid";
type OSSConfigObjType = {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    bucket: string;
    folder: string;
    prefix: string;
};

export type OssUploadButtonStates = {
    isActive: boolean,
    ossPercent: number,
    converterPercent: number,
    uploadState: PPTProgressPhase,
};

export const FileUploadStatic: string = "application/pdf, " +
    "application/vnd.openxmlformats-officedocument.presentationml.presentation, " +
    "application/vnd.ms-powerpoint, " +
    "application/msword, " +
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type OssUploadButtonProps = {
    room: Room,
    oss: OSSConfigObjType,
    appIdentifier: string;
    sdkToken: string;
    whiteboardRef?: HTMLDivElement,
};

export default class OssUploadButton extends React.Component<OssUploadButtonProps, OssUploadButtonStates> {
    private readonly client: any;

    public constructor(props: OssUploadButtonProps) {
        super(props);
        this.state = {
            isActive: false,
            ossPercent: 0,
            converterPercent: 0,
            uploadState: PPTProgressPhase.Stop,
        };
        this.client = new OSS({
            accessKeyId: props.oss.accessKeyId,
            accessKeySecret: props.oss.accessKeySecret,
            region: props.oss.region,
            bucket: props.oss.bucket,
        });
    }

    private uploadStatic = async (event: any): Promise<void> => {
        const {uuid, roomToken} = this.props.room;
        const uploadManager = new UploadManager(this.client, this.props.room);
        const whiteWebSdk = new WhiteWebSdk({appIdentifier: this.props.appIdentifier});
        const pptConverter = whiteWebSdk.pptConverter(roomToken);
        try {
            await uploadManager.convertFile(
                event.file,
                pptConverter,
                PPTKind.Static,
                this.props.oss.folder,
                uuid,
                this.props.sdkToken,
                this.progress,
            );
        } catch (error) {
            message.error(error);
        }
    }

    private uploadDynamic = async (event: any): Promise<void> => {
        const {uuid, roomToken} = this.props.room;
        const uploadManager = new UploadManager(this.client, this.props.room);
        const whiteWebSdk = new WhiteWebSdk({appIdentifier: this.props.appIdentifier});
        const pptConverter = whiteWebSdk.pptConverter(roomToken);
        try {
            await uploadManager.convertFile(
                event.file,
                pptConverter,
                PPTKind.Dynamic,
                this.props.oss.folder,
                uuid,
                this.props.sdkToken,
                this.progress,
            );
        } catch (error) {
            message.error(error);
        }
    }

    private progress = (phase: PPTProgressPhase, percent: number): void => {
        this.setState({uploadState: phase});
        switch (phase) {
            case PPTProgressPhase.Uploading: {
                this.setState({ossPercent: percent * 100});
                break;
            }
            case PPTProgressPhase.Converting: {
                this.setState({converterPercent: percent * 100});
                break;
            }
            case PPTProgressPhase.Stop: {
                this.setState({converterPercent: 0});
                this.setState({ossPercent: 0});
            }
        }
    }

    public componentDidUpdate(prevProps: Readonly<OssUploadButtonProps>, prevState: Readonly<OssUploadButtonStates>, snapshot?: any) {
        if (this.state.uploadState !== prevState.uploadState) {
            if (this.state.uploadState === PPTProgressPhase.Uploading) {
                message.destroy();
                message.loading(`正在上传`, 0);
            } else if (this.state.uploadState === PPTProgressPhase.Converting) {
                message.destroy();
                message.loading(`正在转码`, 0);
            } else {
                message.destroy();
            }
        }
    }

    private uploadImage = async (event: any): Promise<void> => {
        const uploadFileArray: File[] = [];
        uploadFileArray.push(event.file);
        const uploadManager = new UploadManager(this.client, this.props.room);
        try {
            if (this.props.whiteboardRef) {
                const {clientWidth, clientHeight} = this.props.whiteboardRef;
                await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, this.progress);
            } else {
                const clientWidth = window.innerWidth;
                const clientHeight = window.innerHeight;
                await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, this.progress);
            }
        } catch (error) {
            message.error(error);
        }
    }

    private getUrl = async (event: any): Promise<string> => {
        const uploadManager = new UploadManager(this.client, this.props.room);
        const res = await uploadManager.addFile(`${uuidv4()}/${event.file.name}`, event.file, this.progress);
        const isHttps = res.indexOf("https") !== -1;
        let url;
        if (isHttps) {
            url = res;
        } else {
            url = res.replace("http", "https");
        }
        return url;
    }

    private uploadVideo = async (event: any): Promise<void> => {
        try {
            const url = await this.getUrl(event);
            if (url) {
                this.props.room.insertPlugin("video", {
                    originX: -240,
                    originY: -135,
                    width: 480,
                    height: 270,
                    attributes: {
                        pluginVideoUrl: url,
                    },
                });
            }
        } catch (err) {
            console.log(err);
        }
    }

    private uploadAudio = async (event: any): Promise<void> => {
        try {
            const url = await this.getUrl(event);
            if (url) {
                this.props.room.insertPlugin("audio", {
                    originX: -240,
                    originY: -43,
                    width: 480,
                    height: 86,
                    attributes: {
                        pluginAudioUrl: url,
                    },
                });
            }
        } catch (err) {
            console.log(err);
        }
    }

    private renderUploadButton = (): React.ReactNode => {
        return (
            <div className="oss-upload-box">
                <Upload
                    accept={"image/*"}
                    showUploadList={false}
                    customRequest={this.uploadImage}>
                    <div className="oss-upload-section">
                        <div className="oss-upload-section-inner">
                            <div className="oss-upload-title-section">
                                <div className="oss-upload-title">上传图片</div>
                                <div className="oss-upload-icon">
                                    <img src={image}/>
                                </div>
                            </div>
                            <div className="oss-upload-section-script">
                                <div className="oss-upload-section-text">
                                    支持常见格式，可以改变图片大小和位置。
                                </div>
                            </div>
                        </div>
                    </div>
                </Upload>
                <div style={{width: 208, height: 0.5, backgroundColor: "#E7E7E7"}}/>
                <Upload
                    accept={"video/mp4"}
                    showUploadList={false}
                    customRequest={this.uploadVideo}>
                    <div className="oss-upload-section">
                        <div className="oss-upload-section-inner">
                            <div className="oss-upload-title-section">
                                <div className="oss-upload-title">上传视频</div>
                                <div className="oss-upload-icon">
                                    <img src={Video}/>
                                </div>
                            </div>
                            <div className="oss-upload-section-script">
                                <div className="oss-upload-section-text">支持 MP4 格式</div>
                            </div>
                        </div>
                    </div>
                </Upload>
                <div style={{width: 208, height: 0.5, backgroundColor: "#E7E7E7"}}/>
                <Upload
                    accept={"audio/mp3"}
                    showUploadList={false}
                    customRequest={this.uploadAudio}>
                    <div className="oss-upload-section">
                        <div className="oss-upload-section-inner">
                            <div className="oss-upload-title-section">
                                <div className="oss-upload-title">上传音频</div>
                                <div className="oss-upload-icon">
                                    <img src={Audio}/>
                                </div>
                            </div>
                            <div className="oss-upload-section-script">
                                <div className="oss-upload-section-text">支持 MP3 格式</div>
                            </div>
                        </div>
                    </div>
                </Upload>
                <div style={{width: 208, height: 0.5, backgroundColor: "#E7E7E7"}}/>
                <Upload
                    accept={"application/vnd.openxmlformats-officedocument.presentationml.presentation"}
                    showUploadList={false}
                    customRequest={this.uploadDynamic}>
                    <div className="oss-upload-section">
                        <div className="oss-upload-section-inner">
                            <div className="oss-upload-title-section">
                                <div className="oss-upload-title">资料转网页</div>
                                <div className="oss-upload-icon">
                                    <img src={fileTransWeb} alt={"fileTransWeb"}/>
                                </div>
                            </div>
                            <div className="oss-upload-section-script">
                                <div className="oss-upload-section-text">支持 pptx 格式，如果是 ppt 格式，请手动转换。</div>
                            </div>
                        </div>
                    </div>
                </Upload>
                <div style={{width: 208, height: 0.5, backgroundColor: "#E7E7E7"}}/>
                <Upload
                    accept={FileUploadStatic}
                    showUploadList={false}
                    customRequest={this.uploadStatic}>
                    <div className="oss-upload-section">
                        <div className="oss-upload-section-inner">
                            <div className="oss-upload-title-section">
                                <div className="oss-upload-title">文档转图片</div>
                                <div className="oss-upload-icon">
                                    <img src={fileTransImg} alt={"fileTransImg"}/>
                                </div>
                            </div>
                            <div className="oss-upload-section-script">
                                <div className="oss-upload-section-text">Support ppt、pptx、word and pdf.</div>
                            </div>
                        </div>
                    </div>
                </Upload>
            </div>
        );
    }


    private handleVisibleChange = (event: boolean): void => {
        this.setState({isActive: event})
    }

    public render(): React.ReactNode {
        const {isActive} = this.state;
        return [
            <TopLoadingBar key={"top-loading-bar-oss"} style={{backgroundColor: "#71C3FC", height: 4}} loadingPercent={this.state.ossPercent}/>,
            <TopLoadingBar key={"top-loading-bar-converter"} style={{backgroundColor: "#71C3FC", height: 4}}
                           loadingPercent={this.state.converterPercent}/>,
            <Popover trigger="click"
                     key={"oss-upload-popper"}
                     onVisibleChange={this.handleVisibleChange}
                     placement={"leftBottom"}
                     content={this.renderUploadButton()}>
                <Tooltip placement={"right"} title={"upload"}>
                    <div className="oss-upload-cell-box-left">
                        <div className="oss-upload-cell">
                            <img src={isActive ? uploadActive : upload} alt={"upload"}/>
                        </div>
                    </div>
                </Tooltip>
            </Popover>
        ];
    }
}
