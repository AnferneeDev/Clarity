import os
import zipfile
import sys

def zip_dir(path, ziph):
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.zip'):
                continue
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, path)
            ziph.write(file_path, arcname)

if __name__ == '__main__':
    zip_name = sys.argv[1]
    dir_to_zip = '.'
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zip_dir(dir_to_zip, zipf)
