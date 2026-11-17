import json
import os
import re

class ArticleManager:
    def __init__(self):
        self.path = os.path.dirname(os.path.abspath(__file__))
        self.articles_path = os.path.join(self.path, "articles")
        
    def list_articles(self):
        return os.listdir(self.articles_path)

    def process_files(self, filename):
        name = filename
        priority = 0
        secret = False
        while True:
            match = re.match(r"^\[(T[1-3]?|S)\]", name)
            if not match:
                break
            tag = match.group(1)
            if tag == "S":
                secret = True
            else:
                level = 1 if tag == "T" else int(tag[1:])
                priority = max(priority, 4 - level)
            name = name[match.end():]
        pinned = priority > 0
        title = re.sub(r"^\d{4}-\d{2}-\d{2}[-_\s]+", "", os.path.splitext(name)[0])
        date_match = re.match(r"^\d{4}-\d{2}-\d{2}", name)
        date = date_match.group() if date_match else ""
        filepath = "articles/" + filename
        return [filepath, title, date, pinned, priority, secret]
    
    def process_json_files(self, filedata):
        filepath, title, date, pinned, priority, secret = filedata
        return {
            "file": filepath,
            "title": title,
            "date": date,
            "pinned": pinned,
            "priority": priority,
            "secret": secret
        }
    
    def write_json_file(self, filedata):
        data = self.process_json_files(filedata)
        json_filepath = filedata[0].replace(".txt", ".json")
        try:
            with open("posts.json", "r") as json_file:
                posts = json.load(json_file)
        except FileNotFoundError:
            posts = []
        posts.append(data)
        with open("posts.json", "w") as json_file:
            json.dump(posts, json_file, indent=4)
    
    def init_json_file(self):
        if not os.path.exists("posts.json"):
            with open("posts.json", "w") as json_file:
                json.dump([], json_file)
        else:
            with open("posts.json", "w") as json_file:
                json.dump([], json_file, indent=4)

if __name__ == "__main__":
    manager = ArticleManager()
    manager.init_json_file()
    manager.list_articles()
    
    for article in manager.list_articles():
        filedata = manager.process_files(article)
        manager.write_json_file(filedata)

    