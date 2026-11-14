import json
import os

class ArticleManager:
    def __init__(self):
        self.path = os.path.dirname(os.path.abspath(__file__))
        self.articles_path = os.path.join(self.path, "articles")
        
    def list_articles(self):
        return os.listdir(self.articles_path)

    def process_files(self, filename):
        filepath = os.path.join(self.articles_path, filename)
        title = filename.split("-")[3].split(".")[0]
        date = filename.split("-")[0:3]
        date = "-".join(date)
        filepath = "articles/" + filename
        return [filepath, title, date]
    
    def process_json_files(self, filedata):
        filepath, title, date = filedata
        return {"file": filepath, "title": title, "date": date}
    
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

    