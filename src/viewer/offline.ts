interface ResourceGetter {
    getResource(filename: string): Promise<string>;
}

class ExtensionResourceGetter implements ResourceGetter {
    async getResource(filename: string) {
        return new Promise<string>((resolve) => {
            let url = chrome.extension.getURL(filename);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    resolve(<string>xhr.responseText);
                }
            };
            xhr.send();
        });
    }
}

class HTTPResourceGetter implements ResourceGetter {
    async getResource(filename: string) {
        return new Promise<string>((resolve) => {
            resolve('not yet implemented');
        });
    }
}

class Offline {
    resourceGetter: ResourceGetter;

    constructor(resourceGetter: ResourceGetter) {
        this.resourceGetter = resourceGetter;
    }

    async inlineResources(doc: Document): Promise<Document> {
        for (let scriptElement of doc.getElementsByTagName('script')) {
            let url = scriptElement.getAttribute('src');
            let content = await this.resourceGetter.getResource(url);
            scriptElement.removeAttribute('src');
            scriptElement.innerHTML = content;
        }
        let linkElements = Array.from(doc.getElementsByTagName('link'));
        for (let linkElement of linkElements) {
            let url = linkElement.getAttribute('href');
            let content = await this.resourceGetter.getResource(url);
            let styleElement = document.createElement('style');
            styleElement.setAttribute('type', linkElement.getAttribute('type'));
            styleElement.innerHTML = content;
            linkElement.parentNode.appendChild(styleElement);
            linkElement.remove();
        }
        return doc;
    }

    async createOfflineHTML(tree: TweetNode): Promise<string> {
        let treeJson = JSON.stringify(SerializedTweetNode.fromTweetNode(tree));

        let htmlBody: string = await this.resourceGetter.getResource("resources/view.html");

        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlBody, 'text/html');
        doc.getElementById('downloadLink').remove();

        doc = await this.inlineResources(doc);

        let offlineScript = document.createElement('script');
        offlineScript.innerText = `Treeverse.setOfflineData(${treeJson});`;

        doc.getElementsByTagName('head')[0].appendChild(offlineScript);

        return doc.documentElement.innerHTML;
    }
}

class SerializedTweetNode {
    tweet: Tweet;
    children: SerializedTweetNode[] = [];

    static fromTweetNode(tn: TweetNode) {
        let stn = new SerializedTweetNode();
        stn.tweet = tn.tweet;
        tn.children.forEach((v: AbstractTreeNode) => {
            if (v instanceof TweetNode) {
                stn.children.push(SerializedTweetNode.fromTweetNode(v));
            }
        });
        return stn;
    }

    static toTweetNode(obj) {
        let tweet = new Tweet();
        Object.assign(tweet, obj.tweet);
        let tn = new TweetNode(tweet);
        (<SerializedTweetNode[]>obj.children).forEach((child) => {
            tn.children.set(child.tweet.id, SerializedTweetNode.toTweetNode(child));
        });
        tn.fullyLoaded = true;
        return tn;
    }
}