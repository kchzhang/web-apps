import React, {Component, Fragment} from 'react';
import { inject, observer } from "mobx-react";
import { f7 } from 'framework7-react';
import {Device} from '../../../../../common/mobile/utils/device';
import { withTranslation} from 'react-i18next';

import {AddComment, EditComment, ViewComments} from '../../view/collaboration/Comments';

// utils
const timeZoneOffsetInMs = (new Date()).getTimezoneOffset() * 60000;
const utcDateToString = (date) => {
    if (Object.prototype.toString.call(date) === '[object Date]')
        return (date.getTime() - timeZoneOffsetInMs).toString();
    return '';
};
const ooDateToString = (date) => {
    if (Object.prototype.toString.call(date) === '[object Date]')
        return (date.getTime()).toString();
    return '';
};
const stringOOToLocalDate = (date) => {
    if (typeof date === 'string')
        return parseInt(date);
    return 0;
};
const stringUtcToLocalDate = (date) => {
    if (typeof date === 'string')
        return parseInt(date) + timeZoneOffsetInMs;
    return 0;
};
const dateToLocaleTimeString = (date) => {
    const format = (date) => {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let ampm = hours >= 12 ? 'pm' : 'am';

        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
    };
    // MM/dd/yyyy hh:mm AM
    return (date.getMonth() + 1) + '/' + (date.getDate()) + '/' + date.getFullYear() + ' ' + format(date);
};
//end utils

class CommentsController extends Component {
    constructor(props) {
        super(props);
        this.usersStore = this.props.users;
        this.appOptions = this.props.storeAppOptions;
        this.storeComments = this.props.storeComments;

        Common.Notifications.on('engineCreated', api => {
            api.asc_registerCallback('asc_onAddComment', this.addComment.bind(this));
            api.asc_registerCallback('asc_onAddComments', this.addComments.bind(this));
            api.asc_registerCallback('asc_onRemoveComment', this.removeComment.bind(this));
            api.asc_registerCallback('asc_onRemoveComments', this.removeComments.bind(this));
            api.asc_registerCallback('asc_onChangeCommentData', this.changeCommentData.bind(this));
        });

        Common.Notifications.on('comments:filterchange', this.onFilterChange.bind(this)); // for sse

        Common.Notifications.on('configOptionsFill', () => {
            this.curUserId = this.appOptions.user.id;
        });
    }
    addComment (id, data) {
        const comment = this.readSDKComment(id, data);
        if (comment) {
            this.storeComments.addComment(comment);
        }
    }
    addComments (data) {
        for (let i = 0; i < data.length; ++i) {
            const comment = this.readSDKComment(data[i].asc_getId(), data[i]);
            this.storeComments.addComment(comment);
        }
    }
    removeComment (id) {
        this.storeComments.removeComment(id);
    }
    removeComments (data) {
        for (let i = 0; i < data.length; i++) {
            this.removeComment(data[i]);
        }
    }
    changeCommentData (id, data) {
        let date = null;
        let replies = null;
        let repliesCount = 0;
        let dateReply = null;

        const comment = this.storeComments.findComment(id);

        if (comment) {

            date = (data.asc_getOnlyOfficeTime()) ? new Date(stringOOToLocalDate(data.asc_getOnlyOfficeTime())) :
                ((data.asc_getTime() === '') ? new Date() : new Date(stringUtcToLocalDate(data.asc_getTime())));

            let user = this.usersStore.searchUserById(data.asc_getUserId());

            comment.comment = data.asc_getText();
            comment.userid = data.asc_getUserId();
            comment.userName = data.asc_getUserName();
            comment.usercolor = (user) ? user.asc_getColor() : null;
            comment.resolved = data.asc_getSolved();
            comment.quote = data.asc_getQuoteText();
            comment.time = date.getTime();
            comment.date = dateToLocaleTimeString(date);
            comment.editable = this.appOptions.canEditComments || (data.asc_getUserId() === this.curUserId);
            comment.removable = this.appOptions.canDeleteComments || (data.asc_getUserId() === this.curUserId);

            replies = [];

            repliesCount = data.asc_getRepliesCount();
            for (let i = 0; i < repliesCount; ++i) {

                dateReply = (data.asc_getReply(i).asc_getOnlyOfficeTime()) ? new Date(stringOOToLocalDate(data.asc_getReply(i).asc_getOnlyOfficeTime())) :
                    ((data.asc_getReply(i).asc_getTime() === '') ? new Date() : new Date(stringUtcToLocalDate(data.asc_getReply(i).asc_getTime())));

                user = this.usersStore.searchUserById(data.asc_getReply(i).asc_getUserId());
                const userName = data.asc_getReply(i).asc_getUserName();
                replies.push({
                    ind: i,
                    userId: data.asc_getReply(i).asc_getUserId(),
                    userName: userName,
                    userColor: (user) ? user.asc_getColor() : null,
                    date: dateToLocaleTimeString(dateReply),
                    reply: data.asc_getReply(i).asc_getText(),
                    time: dateReply.getTime(),
                    userInitials: this.usersStore.getInitials(userName),
                    editable: this.appOptions.canEditComments || (data.asc_getReply(i).asc_getUserId() === this.curUserId),
                    removable: this.appOptions.canDeleteComments || (data.asc_getReply(i).asc_getUserId() === this.curUserId)
                });
            }
            comment.replies = replies;
        }
    }
    onFilterChange (filter) {
        this.storeComments.changeFilter(filter);
    }
    readSDKComment (id, data) {
        const date = (data.asc_getOnlyOfficeTime()) ? new Date(stringOOToLocalDate(data.asc_getOnlyOfficeTime())) :
            ((data.asc_getTime() === '') ? new Date() : new Date(stringUtcToLocalDate(data.asc_getTime())));
        const user = this.usersStore.searchUserById(data.asc_getUserId());
        const groupName = id.substr(0, id.lastIndexOf('_')+1).match(/^(doc|sheet[0-9_]+)_/);
        const userName = data.asc_getUserName();
        const comment = {
            uid                 : id,
            userId              : data.asc_getUserId(),
            userName            : userName,
            userColor           : (user) ? user.asc_getColor() : null,
            date                : dateToLocaleTimeString(date),
            quote               : data.asc_getQuoteText(),
            comment             : data.asc_getText(),
            resolved            : data.asc_getSolved(),
            unattached          : !!data.asc_getDocumentFlag ? data.asc_getDocumentFlag() : false,
            time                : date.getTime(),
            replies             : [],
            groupName           : (groupName && groupName.length>1) ? groupName[1] : null,
            userInitials        : this.usersStore.getInitials(userName),
            editable            : this.appOptions.canEditComments || (data.asc_getUserId() === this.curUserId),
            removable           : this.appOptions.canDeleteComments || (data.asc_getUserId() === this.curUserId)
        };
        if (comment) {
            const replies = this.readSDKReplies(data);
            if (replies.length > 0) {
                comment.replies = replies;
            }
        }
        return comment;
    }
    readSDKReplies (data) {
        const replies = [];
        const repliesCount = data.asc_getRepliesCount();
        let i = 0;
        let date = null;
        if (repliesCount) {
            for (i = 0; i < repliesCount; ++i) {
                date = (data.asc_getReply(i).asc_getOnlyOfficeTime()) ? new Date(stringOOToLocalDate(data.asc_getReply(i).asc_getOnlyOfficeTime())) :
                    ((data.asc_getReply(i).asc_getTime() === '') ? new Date() : new Date(stringUtcToLocalDate(data.asc_getReply(i).asc_getTime())));
                const user = this.usersStore.searchUserById(data.asc_getReply(i).asc_getUserId());
                const userName = data.asc_getReply(i).asc_getUserName();
                replies.push({
                    ind                 : i,
                    userId              : data.asc_getReply(i).asc_getUserId(),
                    userName            : userName,
                    userColor           : (user) ? user.asc_getColor() : null,
                    date                : dateToLocaleTimeString(date),
                    reply               : data.asc_getReply(i).asc_getText(),
                    time                : date.getTime(),
                    userInitials        : this.usersStore.getInitials(userName),
                    editable            : this.appOptions.canEditComments || (data.asc_getReply(i).asc_getUserId() === this.curUserId),
                    removable           : this.appOptions.canDeleteComments || (data.asc_getReply(i).asc_getUserId() === this.curUserId)
                });
            }
        }
        return replies;
    }
    render() {
        return null;
    }
}

class AddCommentController extends Component {
    constructor(props) {
        super(props);
        this.getUserInfo = this.getUserInfo.bind(this);
        this.onAddNewComment = this.onAddNewComment.bind(this);
    }
    getUserInfo () {
        this.currentUser = this.props.users.currentUser;
        const name = this.currentUser.asc_getUserName();
        return {
            name: name,
            initials: this.props.users.getInitials(name),
            color: this.currentUser.asc_getColor()
        };
    }
    onAddNewComment (commentText, documentFlag) {
        const api = Common.EditorApi.get();
        let comment;
        if (typeof Asc.asc_CCommentDataWord !== 'undefined') {
            comment = new Asc.asc_CCommentDataWord(null);
        } else {
            comment = new Asc.asc_CCommentData(null);
        }
        if (commentText.length > 0) {
            comment.asc_putText(commentText);
            comment.asc_putTime(utcDateToString(new Date()));
            comment.asc_putOnlyOfficeTime(ooDateToString(new Date()));
            comment.asc_putUserId(this.currentUser.asc_getIdOriginal());
            comment.asc_putUserName(this.currentUser.asc_getUserName());
            comment.asc_putSolved(false);

            !!comment.asc_putDocumentFlag && comment.asc_putDocumentFlag(documentFlag);

            api.asc_addComment(comment);

            return true;
        }
        return false;
    }
    render() {
        const isOpen = this.props.storeComments.isOpenAddComment;
        let userInfo;
        if (isOpen) {
            userInfo = this.getUserInfo();
        }
        return(
            isOpen ? <AddComment userInfo={userInfo} onAddNewComment={this.onAddNewComment} /> : null
        )
    }
}

class ViewCommentsController extends Component {
    constructor (props) {
        super(props);
        this.onCommentMenuClick = this.onCommentMenuClick.bind(this);
        this.onResolveComment = this.onResolveComment.bind(this);
        this.onEditComment = this.onEditComment.bind(this);
        this.closeEditComment = this.closeEditComment.bind(this);

        this.currentUser = this.props.users.currentUser;

        this.state = {
            showEditComment: false,
            showEditReply: false
        };
    }
    onChangeComment (comment) {
        const ascComment = !!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null);
        if (ascComment && comment) {
            ascComment.asc_putText(comment.comment);
            ascComment.asc_putQuoteText(comment.quote);
            ascComment.asc_putTime(utcDateToString(new Date(comment.time)));
            ascComment.asc_putOnlyOfficeTime(ooDateToString(new Date(comment.time)));
            ascComment.asc_putUserId(comment.userId);
            ascComment.asc_putUserName(comment.userName);
            ascComment.asc_putSolved(comment.resolved);
            ascComment.asc_putGuid(comment.guid);

            if (!!ascComment.asc_putDocumentFlag) {
                ascComment.asc_putDocumentFlag(comment.unattached);
            }

            var reply = comment.replies;
            if (reply && reply.length > 0) {
                reply.forEach((reply) => {
                    var addReply = (!!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null));
                    if (addReply) {
                        addReply.asc_putText(reply.reply);
                        addReply.asc_putTime(utcDateToString(new Date(reply.time)));
                        addReply.asc_putOnlyOfficeTime(ooDateToString(new Date(reply.time)));
                        addReply.asc_putUserId(reply.userId);
                        addReply.asc_putUserName(reply.userName);

                        ascComment.asc_addReply(addReply);
                    }
                });
            }
            const api = Common.EditorApi.get();
            api.asc_changeComment(comment.uid, ascComment);
        }
    }
    onResolveComment (comment) {
        let reply = null,
            addReply = null,
            ascComment = (!!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null));

        if (ascComment && comment) {
            ascComment.asc_putText(comment.comment);
            ascComment.asc_putQuoteText(comment.quote);
            ascComment.asc_putTime(utcDateToString(new Date(comment.time)));
            ascComment.asc_putOnlyOfficeTime(ooDateToString(new Date(comment.time)));
            ascComment.asc_putUserId(comment.userId);
            ascComment.asc_putUserName(comment.userName);
            ascComment.asc_putSolved(!comment.resolved);
            ascComment.asc_putGuid(comment.guid);

            if (!!ascComment.asc_putDocumentFlag) {
                ascComment.asc_putDocumentFlag(comment.unattached);
            }

            reply = comment.replies;
            if (reply && reply.length > 0) {
                reply.forEach((reply) => {
                    addReply = (!!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null));
                    if (addReply) {
                        addReply.asc_putText(reply.reply);
                        addReply.asc_putTime(utcDateToString(new Date(reply.time)));
                        addReply.asc_putOnlyOfficeTime(ooDateToString(new Date(reply.time)));
                        addReply.asc_putUserId(reply.userId);
                        addReply.asc_putUserName(reply.userName);

                        ascComment.asc_addReply(addReply);
                    }
                });
            }
            const api = Common.EditorApi.get();
            api.asc_changeComment(comment.uid, ascComment);
        }
    }
    deleteComment (comment) {
        const api = Common.EditorApi.get();
        comment && api.asc_removeComment(comment.uid);
    }
    onEditComment (comment, text) {
        comment.comment = text.trim();
        comment.userid = this.currentUser.asc_getIdOriginal();
        comment.username = this.currentUser.asc_getUserName();
        this.onChangeComment(comment);
    }
    deleteReply (comment, indReply) {
        let replies = null,
            addReply = null,
            ascComment = (!!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null));

        if (ascComment && comment) {
            ascComment.asc_putText(comment.comment);
            ascComment.asc_putQuoteText(comment.quote);
            ascComment.asc_putTime(utcDateToString(new Date(comment.time)));
            ascComment.asc_putOnlyOfficeTime(ooDateToString(new Date(comment.time)));
            ascComment.asc_putUserId(comment.userId);
            ascComment.asc_putUserName(comment.userName);
            ascComment.asc_putSolved(comment.resolved);
            ascComment.asc_putGuid(comment.guid);

            if (!!ascComment.asc_putDocumentFlag) {
                ascComment.asc_putDocumentFlag(comment.unattached);
            }

            replies = comment.replies;
            if (replies && replies.length) {
                replies.forEach((reply) => {
                    if (reply.ind !== indReply) {
                        addReply = (!!Asc.asc_CCommentDataWord ? new Asc.asc_CCommentDataWord(null) : new Asc.asc_CCommentData(null));
                        if (addReply) {
                            addReply.asc_putText(reply.reply);
                            addReply.asc_putTime(utcDateToString(new Date(reply.time)));
                            addReply.asc_putOnlyOfficeTime(ooDateToString(new Date(reply.time)));
                            addReply.asc_putUserId(reply.userId);
                            addReply.asc_putUserName(reply.userName);

                            ascComment.asc_addReply(addReply);
                        }
                    }
                });
            }
            const api = Common.EditorApi.get();
            api.asc_changeComment(comment.uid, ascComment);
        }
    }
    onCommentMenuClick (action, comment) {
        const { t } = this.props;
        const _t = t("Common.Collaboration", { returnObjects: true });
        switch (action) {
            case 'editComment':
                this.setState({
                    showEditComment: true,
                    editProps: {
                        comment: comment,
                        onEditComment: this.onEditComment
                    }
                });
                console.log('editComment');
                break;
            case 'resolve':
                this.onResolveComment(comment);
                break;
            case 'deleteComment':
                f7.dialog.confirm(
                    _t.textMessageDeleteComment,
                    _t.textDeleteComment,
                    () => {
                        this.deleteComment(comment);
                    }
                );
                break;
            case 'editReply':
                this.setState({showEditReply: true});
                console.log('editReply');
                break;
            case 'deleteReply':
                f7.dialog.confirm(
                    _t.textMessageDeleteReply,
                    _t.textDeleteReply,
                    () => {
                        this.deleteReply(comment, indReply);
                    }
                );
                break;
            case 'addReply':
                console.log('addReply');
                break;
        }
    }

    closeEditComment () {
        this.setState({showEditComment: false});
    }
    render() {
        return(
            <Fragment>
                <ViewComments showEditComment={this.showEditComment}
                              onCommentMenuClick={this.onCommentMenuClick}
                              onResolveComment={this.onResolveComment}
                />
                {this.state.showEditComment && <EditComment editProps={this.state.editProps} opened={this.state.showEditComment} close={this.closeEditComment}/>}
            </Fragment>
        )
    }
}

const _CommentsController = inject('storeAppOptions', 'storeComments', 'users')(observer(CommentsController));
const _AddCommentController = inject('storeAppOptions', 'storeComments', 'users')(observer(AddCommentController));
const _ViewCommentsController = inject('storeComments', 'users')(observer(withTranslation()(ViewCommentsController)));

export {
    _CommentsController as CommentsController,
    _AddCommentController as AddCommentController,
    _ViewCommentsController as ViewCommentsController
};