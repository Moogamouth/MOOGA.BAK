import socket

def start_client():
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect(("localhost", 9999))

    while True:
        filename = client.recv(1024).decode("utf-8")
        response = input("Do you accept or reject the file? (accept/reject): ")
        client.send(response.encode("utf-8"))

        if response.lower() == 'accept':
            message = client.recv(1024).decode("utf-8")
            print(message)

            with open(f"1{filename}", "wb") as file:
                while True:
                    file_data = client.recv(1024)
                    if not file_data:
                        break
                    file.write(file_data)

        if not message:
            break

    client.close()

if __name__ == "__main__":
    start_client()
