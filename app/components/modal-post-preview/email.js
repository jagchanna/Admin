import Component from '@glimmer/component';
import {action} from '@ember/object';
import {inject as service} from '@ember/service';
import {timeout} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

const INJECTED_CSS = `
html::-webkit-scrollbar {
    display: none;
    width: 0;
    background: transparent
}
html {
    scrollbar-width: none;
}
`;

// TODO: remove duplication with <ModalPostEmailPreview>
export default class ModalPostPreviewEmailComponent extends Component {
    @service ajax;
    @service config;
    @service ghostPaths;
    @service settings;

    @tracked html = '';
    @tracked subject = '';

    @action
    async renderEmailPreview(iframe) {
        await this._fetchEmailData();
        // avoid timing issues when _fetchEmailData didn't perform any async ops
        await timeout(100);

        if (iframe) {
            iframe.contentWindow.document.open();
            iframe.contentWindow.document.write(this.html);
            iframe.contentWindow.document.close();
        }
    }

    async _fetchEmailData() {
        let {html, subject} = this;
        let {post} = this.args;

        if (html && subject) {
            return {html, subject};
        }

        // model is an email
        if (post.html && post.subject) {
            html = post.html;
            subject = post.subject;
        // model is a post with an existing email
        } else if (post.email) {
            html = post.email.html;
            subject = post.email.subject;
        // model is a post, fetch email preview
        } else {
            let url = this.ghostPaths.url.api('/email_preview/posts', post.id);
            let response = await this.ajax.request(url);
            let [emailPreview] = response.email_previews;
            html = emailPreview.html;
            subject = emailPreview.subject;
        }

        // inject extra CSS into the html for disabling links and scrollbars etc
        let domParser = new DOMParser();
        let htmlDoc = domParser.parseFromString(html, 'text/html');
        let stylesheet = htmlDoc.querySelector('style');
        let originalCss = stylesheet.innerHTML;
        stylesheet.innerHTML = `${originalCss}\n\n${INJECTED_CSS}`;
        html = htmlDoc.documentElement.innerHTML;

        this.html = html;
        this.subject = subject;
    }
}